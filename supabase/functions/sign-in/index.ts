// Password sign in with an attempt limit.
//
// The apps and the admin portal call this instead of signing in directly.
// It checks the limit, then makes the real Supabase Auth password sign in, and
// records the result. Failures are counted from what Supabase Auth actually
// answered, never from what a client says, so they cannot be faked to lock
// someone else out without really sending wrong passwords.
//
// Limit: 5 wrong passwords for an email in 15 minutes locks that email until
// the oldest failure leaves the window; one network address may send at most
// 30 attempts in 10 minutes (this also protects the single address Supabase
// Auth sees for everyone coming through here). See lockout.ts.
//
// verify_jwt is false on purpose: nobody is signed in yet.
// Always answers HTTP 200 with { session } or { error: { message, ... } }.

import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  IP_WINDOW_MS,
  LOCK_WINDOW_MS,
  failuresSinceLastSuccess,
  ipIsThrottled,
  lockMessage,
  lockState,
  normalizeEmail,
} from './lockout.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function fail(message: string, extra: Record<string, unknown> = {}): Response {
  return json({ error: { message, ...extra } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    const rawEmail = body?.email;
    const password = body?.password;
    if (typeof rawEmail !== 'string' || typeof password !== 'string' || !rawEmail || !password) {
      return fail('Enter your email and password.');
    }
    if (rawEmail.length > 254 || password.length > 256) return fail('Invalid login credentials');

    const email = normalizeEmail(rawEmail);
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
    const now = Date.now();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // 1. One network address cannot send an unlimited number of attempts.
    const { count: ipCount, error: ipError } = await supabase
      .from('login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('created_at', new Date(now - IP_WINDOW_MS).toISOString());
    if (ipError) throw new Error(ipError.message);
    if (ipIsThrottled(ipCount ?? 0)) {
      return fail('Too many sign in attempts from this network. Please wait a few minutes and try again.', { code: 'ip_throttled' });
    }

    // 2. Is this email locked right now?
    const { data: recent, error: recentError } = await supabase
      .from('login_attempts')
      .select('success, created_at')
      .eq('email_key', email)
      .gte('created_at', new Date(now - LOCK_WINDOW_MS).toISOString())
      .order('created_at', { ascending: false });
    if (recentError) throw new Error(recentError.message);

    const failures = failuresSinceLastSuccess(
      (recent ?? []).map((r) => ({ success: r.success as boolean, createdAtMs: new Date(r.created_at as string).getTime() })),
    );
    const before = lockState(failures, now);
    if (before.locked) {
      return fail(lockMessage(before.retryAfterSeconds), { code: 'too_many_attempts', retryAfterSeconds: before.retryAfterSeconds });
    }

    // 3. The real password check, by Supabase Auth.
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY')!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const authBody = await authResponse.json().catch(() => ({}));

    if (authResponse.ok) {
      await supabase.from('login_attempts').insert({ email_key: email, ip, success: true });
      return json({ session: authBody });
    }

    // Only a wrong password counts. Anything else (unconfirmed email, Auth's own limit, an outage) is passed on as is.
    if (authBody?.error_code !== 'invalid_credentials') {
      return fail(authBody?.msg ?? authBody?.message ?? 'Sign in failed. Please try again.', { code: authBody?.error_code });
    }

    await supabase.from('login_attempts').insert({ email_key: email, ip, success: false });
    const after = lockState([...failures, now], now);
    if (after.locked) {
      return fail(lockMessage(after.retryAfterSeconds), { code: 'too_many_attempts', retryAfterSeconds: after.retryAfterSeconds });
    }

    const base = authBody?.msg ?? authBody?.message ?? 'Invalid login credentials';
    const hint = after.attemptsLeft <= 2 ? ` ${after.attemptsLeft} ${after.attemptsLeft === 1 ? 'attempt' : 'attempts'} left.` : '';
    return fail(`${base}.${hint}`.replace('..', '.'), { code: 'invalid_credentials', attemptsLeft: after.attemptsLeft });
  } catch (err) {
    console.error('sign-in:', err instanceof Error ? err.message : err);
    return fail('Sign in is unavailable right now. Please try again.', { code: 'unavailable' });
  }
});
