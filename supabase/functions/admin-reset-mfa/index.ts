// An Administrator removes another PSO user's MFA factors (lost or replaced phone), so that person sets MFA up
// again at their next sign-in. Deleting someone else's factor needs the service-role key, which must never reach
// the browser, so it can only happen here.
//
// Guards, in order: a signed-in caller; the caller is an active Administrator; the caller's own session has passed
// MFA (aal2 in the JWT) so a stolen password alone cannot reset anyone; the target is a staff account and not the
// caller. People set up their own MFA again through the normal sign-in flow, not through this function.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { assuranceLevel } from './aal.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STAFF_ROLES = ['pso_staff', 'pso_supervisor', 'admin'];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Not authenticated' }, 401);
    const callerId = userData.user.id;

    const { data: callerRow, error: callerError } = await supabase.from('users').select('role, status').eq('id', callerId).single();
    if (callerError || !callerRow) return json({ error: 'Could not verify caller' }, 500);
    if (callerRow.role !== 'admin') return json({ error: 'Only an Administrator may reset MFA' }, 403);
    if (callerRow.status !== 'active' && callerRow.status !== 'flagged') return json({ error: 'Your account is not active' }, 403);
    if (assuranceLevel(authHeader) !== 'aal2') return json({ error: 'Verify your MFA code first' }, 403);

    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const targetId = typeof body.userId === 'string' ? body.userId : '';
    if (!targetId) return json({ error: 'userId is required' }, 400);
    if (targetId === callerId) return json({ error: 'You cannot reset your own MFA here' }, 400);

    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: targetRow, error: targetError } = await service.from('users').select('role').eq('id', targetId).maybeSingle();
    if (targetError) return json({ error: targetError.message }, 500);
    if (!targetRow || !STAFF_ROLES.includes(targetRow.role)) return json({ error: 'That account is not a PSO user' }, 404);

    const { data: factors, error: listError } = await service.auth.admin.mfa.listFactors({ userId: targetId });
    if (listError) return json({ error: listError.message }, 500);

    for (const factor of factors?.factors ?? []) {
      const { error: deleteError } = await service.auth.admin.mfa.deleteFactor({ id: factor.id, userId: targetId });
      if (deleteError) return json({ error: deleteError.message }, 500);
    }

    console.log('admin-reset-mfa', { by: callerId, target: targetId });
    return json({ error: null });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
  }
});
