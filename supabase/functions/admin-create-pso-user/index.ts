// FR-6.3: an Administrator creates a real PSO account (pso_staff,
// pso_supervisor, or admin) directly, with no email/invite infrastructure in
// the repo. This can only run server-side: creating another person's auth
// account needs the service-role key, which must never reach the browser.
//
// handle_new_auth_user() (the auth.users insert trigger) always downgrades
// any non-'driver' metadata role to 'passenger' — a deliberate guard against
// privilege escalation through the public signup API. That guard applies
// here too (this still goes through the same trigger), so the real PSO role
// is set in a second step, after creation, using the service-role client.
//
// No email is sent (no infra to send one) — a one-time temp password is
// generated here and returned directly in the response for the admin UI to
// display once. It is never logged or stored anywhere else.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_ROLES = ['pso_staff', 'pso_supervisor', 'admin'] as const;
type PsoRole = (typeof VALID_ROLES)[number];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function generateTempPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const random = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, 'x')
    .replace(/\//g, 'y')
    .replace(/=/g, '');
  // Guarantee at least one digit and one symbol so this clears any
  // reasonable password-complexity policy, on top of its length/entropy.
  return `Tq7!${random}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ userId: null, tempPassword: null, error: 'Missing Authorization header' }, 401);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ userId: null, tempPassword: null, error: 'Not authenticated' }, 401);

    const { data: callerRow, error: callerError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userData.user.id)
      .single();

    if (callerError || !callerRow) return json({ userId: null, tempPassword: null, error: 'Could not verify caller' }, 500);
    if (callerRow.role !== 'admin') {
      return json({ userId: null, tempPassword: null, error: 'Only an Administrator may create PSO accounts' }, 403);
    }

    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const role = typeof body.role === 'string' ? body.role : '';

    if (!fullName) return json({ userId: null, tempPassword: null, error: 'Full name is required' }, 400);
    if (!email) return json({ userId: null, tempPassword: null, error: 'Email is required' }, 400);
    if (!VALID_ROLES.includes(role as PsoRole)) {
      return json({ userId: null, tempPassword: null, error: 'Role must be pso_staff, pso_supervisor, or admin' }, 400);
    }

    const tempPassword = generateTempPassword();
    const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError || !created.user) {
      return json({ userId: null, tempPassword: null, error: createError?.message ?? 'Could not create account' }, 500);
    }

    const { error: roleError } = await serviceClient.from('users').update({ role: role as PsoRole }).eq('id', created.user.id);

    if (roleError) {
      // Don't leave an orphaned passenger-role account behind if the role
      // assignment fails — the create step already succeeded from Auth's
      // point of view, so this is cleanup, not a race with anyone else.
      await serviceClient.auth.admin.deleteUser(created.user.id).catch(() => {});
      return json({ userId: null, tempPassword: null, error: roleError.message }, 500);
    }

    return json({ userId: created.user.id, tempPassword, error: null });
  } catch (err) {
    return json({ userId: null, tempPassword: null, error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
  }
});
