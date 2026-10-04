import type { Session } from '@supabase/supabase-js';
import { getPasswordCheckClient, getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export type PublicUser = Database['public']['Tables']['users']['Row'];

export interface SignUpInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  role?: 'passenger' | 'driver';
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface AuthResult {
  session: Session | null;
  error: string | null;
}

/**
 * The public.users row is created by handle_new_auth_user(), an AFTER INSERT
 * trigger on auth.users that runs in the same transaction as this signup —
 * so a users_contact_no_unique violation there surfaces here as a generic,
 * technical-looking Postgres/GoTrue error rather than a clean one (unlike an
 * email collision, which GoTrue rejects natively before the trigger ever
 * runs). This matches on the constraint name rather than exact wording,
 * since the precise error text GoTrue forwards for a trigger-raised
 * exception hasn't been observed live — tighten the match if it doesn't fire
 * against a real duplicate-signup attempt.
 */
function translateSignUpError(message: string): string {
  if (/users_contact_no_unique/i.test(message)) {
    return 'This mobile number is already registered.';
  }
  // Observed live: GoTrue hides the trigger's real error behind this generic
  // text. The only data-driven way handle_new_auth_user() fails is a phone
  // number another account already uses, so say that instead of the raw text.
  if (/database error saving new user/i.test(message)) {
    return 'We could not create your account. This mobile number may already be registered. Please check it or use a different one.';
  }
  return message;
}

export async function signUp({ firstName, lastName, email, phone, password, role = 'passenger' }: SignUpInput): Promise<AuthResult> {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        // Stripped so two people typing the same number with different
        // spacing (e.g. "0922 444 4955" vs "09224444955") don't slip past
        // users_contact_no_unique as distinct strings.
        phone: phone.replace(/\s+/g, ''),
        role,
      },
    },
  });
  return { session: data.session, error: error ? translateSignUpError(error.message) : null };
}

/**
 * P3/D1 (UAT audit): distinguishes "wrong email/password" from "couldn't
 * reach the server" — both apps previously showed the same raw GoTrue error
 * string for both. `AuthRetryableFetchError` is supabase-js's own name for a
 * failed/timed-out network request (as opposed to `AuthApiError`, a real
 * response from the server rejecting the credentials), so this checks the
 * error's `name` rather than pattern-matching the message text.
 */
function translateLoginError(error: { name?: string; message: string }): string {
  if (error.name === 'AuthRetryableFetchError') {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  return error.message;
}

/**
 * What the `sign-in` edge function sends back: always HTTP 200, with either a
 * Supabase Auth session or an error. See supabase/functions/sign-in.
 */
interface SignInFunctionResponse {
  session?: { access_token?: string; refresh_token?: string };
  error?: { message: string; code?: string };
}

/**
 * Returns the finished result when the sign-in function answered, or null when
 * it could not be used (unreachable, or it reported an internal failure) so the
 * caller can fall back to a direct sign in and people are never locked out of
 * the app by an outage of the limiter itself.
 */
async function signInThroughLimiter(email: string, password: string): Promise<AuthResult | null> {
  const client = getSupabaseClient();
  try {
    const { data, error } = await client.functions.invoke('sign-in', { body: { email, password } });
    if (error) return null;

    const response = data as SignInFunctionResponse | null;
    if (response?.error) {
      if (response.error.code === 'unavailable') return null;
      return { session: null, error: response.error.message };
    }

    const accessToken = response?.session?.access_token;
    const refreshToken = response?.session?.refresh_token;
    if (!accessToken || !refreshToken) return null;

    const { data: set, error: setError } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (setError) return { session: null, error: translateLoginError(setError) };
    return { session: set.session, error: null };
  } catch {
    return null;
  }
}

/**
 * Password sign in with an attempt limit: 5 wrong passwords for an email in 15
 * minutes locks that email for a while (see supabase/functions/sign-in). The
 * limit lives in the sign-in function, so the passenger app, the driver app
 * and the admin portal all get it from this one call.
 */
export async function signIn({ email, password }: SignInInput): Promise<AuthResult> {
  const limited = await signInThroughLimiter(email, password);
  if (limited) return limited;

  const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  return { session: data.session, error: error ? translateLoginError(error) : null };
}

/**
 * `scope: 'local'` — the default scope would revoke every session for this
 * user, on every device. A driver logging out on one phone (or a passenger
 * testing a second device) would otherwise silently kill an already-running
 * session elsewhere, which then fails its next API call with a raw "Session
 * not found" 401 instead of a clean re-login prompt.
 */
export async function signOut(): Promise<void> {
  await getSupabaseClient().auth.signOut({ scope: 'local' });
}

export interface RequestPasswordResetResult {
  error: string | null;
}

/**
 * Triggers Supabase's "Reset Password" email. The project's email template
 * must include `{{ .Token }}` (Dashboard → Auth → Email Templates) for this
 * to deliver a 6-digit code rather than a magic link — this app has no
 * deep-link handling, so verifyPasswordReset() below is the only supported
 * completion path.
 */
export async function requestPasswordReset(email: string): Promise<RequestPasswordResetResult> {
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email);
  return { error: error?.message ?? null };
}

export interface VerifyPasswordResetInput {
  email: string;
  token: string;
}

/** Exchanges the emailed 6-digit code for a live (recovery) session. */
export async function verifyPasswordReset({ email, token }: VerifyPasswordResetInput): Promise<AuthResult> {
  const { data, error } = await getSupabaseClient().auth.verifyOtp({ email, token, type: 'recovery' });
  return { session: data.session, error: error?.message ?? null };
}

export interface UpdatePasswordResult {
  error: string | null;
}

/**
 * Sets a new password — used both by the recovery flow (on the temporary
 * session established by verifyPasswordReset()) and by a voluntary in-app
 * password change (paired with verifyCurrentPassword() above).
 *
 * R7 (existing-system audit): a password change never signed out any other
 * device the account was logged into elsewhere — exactly the moment that
 * matters most for an account-takeover recovery ("I think someone else has
 * my password"), since the whole point of the new password is to lock them
 * out. `signOut({ scope: 'others' })` revokes every refresh token except the
 * one that just set the new password, leaving this session untouched.
 */
export async function updatePassword(newPassword: string): Promise<UpdatePasswordResult> {
  const client = getSupabaseClient();
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };

  await client.auth.signOut({ scope: 'others' });
  return { error: null };
}

/**
 * P1-10 (2026-09-15 launch audit): re-proves the signed-in user still knows
 * their CURRENT password before a voluntary (not forced-first-login, not
 * forgot-password) password change is allowed to proceed. Without this, an
 * already-open session — an unattended, unlocked device — could change the
 * account's password with no re-authentication at all, which is a full
 * account takeover if the device is left unattended. Re-running
 * signInWithPassword against the same account is the standard way to check
 * this without a separate "verify password" endpoint. It runs on a throwaway
 * client (see getPasswordCheckClient) so the live session, and its MFA level,
 * are untouched; the throwaway session is signed out again straight away.
 */
export async function verifyCurrentPassword(email: string, currentPassword: string): Promise<UpdatePasswordResult> {
  const checkClient = getPasswordCheckClient();
  const { data, error } = await checkClient.auth.signInWithPassword({ email, password: currentPassword });
  // The check created a real server session on its own throwaway client; end it (local scope: only that one).
  if (data?.session) await checkClient.auth.signOut({ scope: 'local' }).catch(() => {});
  return { error: error ? 'Current password is incorrect.' : null };
}

/**
 * UAT P20: passenger-initiated account closure. Calls self_deactivate_account()
 * (SECURITY DEFINER — only ever touches the caller's own row, only from
 * 'active' status) then signs out locally, since the account is no longer
 * usable and the client has nothing further to do with the session.
 */
export async function deactivateOwnAccount(): Promise<UpdatePasswordResult> {
  const { error } = await getSupabaseClient().rpc('self_deactivate_account');
  if (error) return { error: error.message };
  await signOut();
  return { error: null };
}

/**
 * UAT A1: self-reported login/logout event for the admin portal's audit
 * trail (login_events table). Best-effort and fire-and-forget by design —
 * a failure here must never block the sign-in/out flow itself, so callers
 * are expected to ignore the result rather than surface it to the user.
 */
export async function recordLoginEvent(eventType: 'login' | 'logout'): Promise<void> {
  const client = getSupabaseClient();
  const { data } = await client.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return;
  await client.from('login_events').insert({ user_id: userId, event_type: eventType });
}

export async function getSession(): Promise<Session | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session;
}

export function onAuthStateChange(callback: (session: Session | null) => void): () => void {
  const { data } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}

export async function getCurrentUserProfile(): Promise<PublicUser | null> {
  const { data: sessionData } = await getSupabaseClient().auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return null;

  const { data, error } = await getSupabaseClient().from('users').select('*').eq('id', userId).single();
  if (error) return null;
  return data;
}

export async function updateProfile({
  firstName,
  lastName,
  phone,
}: {
  firstName: string;
  lastName: string;
  phone?: string;
}): Promise<{ error: string | null }> {
  const { data: sessionData } = await getSupabaseClient().auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { error: 'Not signed in' };

  const { error } = await getSupabaseClient()
    .from('users')
    .update({ first_name: firstName, last_name: lastName, ...(phone !== undefined ? { contact_no: phone } : {}) })
    .eq('id', userId);
  return { error: error?.message ?? null };
}

/** Clears the forced-password-change flag after the admin portal's password-change screen succeeds. */
export async function clearMustChangePassword(): Promise<{ error: string | null }> {
  const { data: sessionData } = await getSupabaseClient().auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { error: 'Not signed in' };

  const { error } = await getSupabaseClient().from('users').update({ must_change_password: false }).eq('id', userId);
  return { error: error?.message ?? null };
}

export async function updateAvatarUrl(avatarUrl: string): Promise<{ error: string | null }> {
  const { data: sessionData } = await getSupabaseClient().auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { error: 'Not signed in' };

  const { error } = await getSupabaseClient().from('users').update({ avatar_url: avatarUrl }).eq('id', userId);
  return { error: error?.message ?? null };
}
