import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export type PublicUser = Database['public']['Tables']['users']['Row'];

export interface SignUpInput {
  fullName: string;
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

export async function signUp({ fullName, email, phone, password, role = 'passenger' }: SignUpInput): Promise<AuthResult> {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone,
        role,
      },
    },
  });
  return { session: data.session, error: error?.message ?? null };
}

export async function signIn({ email, password }: SignInInput): Promise<AuthResult> {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  return { session: data.session, error: error?.message ?? null };
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
  fullName,
  phone,
}: {
  fullName: string;
  phone?: string;
}): Promise<{ error: string | null }> {
  const { data: sessionData } = await getSupabaseClient().auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { error: 'Not signed in' };

  const { error } = await getSupabaseClient()
    .from('users')
    .update({ full_name: fullName, ...(phone !== undefined ? { contact_no: phone } : {}) })
    .eq('id', userId);
  return { error: error?.message ?? null };
}

export async function updateAvatarUrl(avatarUrl: string): Promise<{ error: string | null }> {
  const { data: sessionData } = await getSupabaseClient().auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { error: 'Not signed in' };

  const { error } = await getSupabaseClient().from('users').update({ avatar_url: avatarUrl }).eq('id', userId);
  return { error: error?.message ?? null };
}
