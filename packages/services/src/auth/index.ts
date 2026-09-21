import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabase/client.ts';
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

export async function signIn({ email, password }: SignInInput): Promise<AuthResult> {
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

/** Sets a new password on the current (recovery) session established by verifyPasswordReset(). */
export async function updatePassword(newPassword: string): Promise<UpdatePasswordResult> {
  const { error } = await getSupabaseClient().auth.updateUser({ password: newPassword });
  return { error: error?.message ?? null };
}

/**
 * P1-10 (2026-09-15 launch audit): re-proves the signed-in user still knows
 * their CURRENT password before a voluntary (not forced-first-login, not
 * forgot-password) password change is allowed to proceed. Without this, an
 * already-open session — an unattended, unlocked device — could change the
 * account's password with no re-authentication at all, which is a full
 * account takeover if the device is left unattended. Re-running
 * signInWithPassword against the same account is the standard way to check
 * this without a separate "verify password" endpoint; on success it simply
 * refreshes the existing session rather than creating a new one.
 */
export async function verifyCurrentPassword(email: string, currentPassword: string): Promise<UpdatePasswordResult> {
  const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password: currentPassword });
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
