import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types';

export type PublicUser = Database['public']['Tables']['users']['Row'];

export interface SignUpInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface AuthResult {
  session: Session | null;
  error: string | null;
}

export async function signUp({ fullName, email, phone, password }: SignUpInput): Promise<AuthResult> {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone,
        role: 'passenger',
      },
    },
  });
  return { session: data.session, error: error?.message ?? null };
}

export async function signIn({ email, password }: SignInInput): Promise<AuthResult> {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  return { session: data.session, error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  await getSupabaseClient().auth.signOut();
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

export async function updateProfile({ fullName }: { fullName: string }): Promise<{ error: string | null }> {
  const { data: sessionData } = await getSupabaseClient().auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { error: 'Not signed in' };

  const { error } = await getSupabaseClient().from('users').update({ full_name: fullName }).eq('id', userId);
  return { error: error?.message ?? null };
}

export async function updateAvatarUrl(avatarUrl: string): Promise<{ error: string | null }> {
  const { data: sessionData } = await getSupabaseClient().auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { error: 'Not signed in' };

  const { error } = await getSupabaseClient().from('users').update({ avatar_url: avatarUrl }).eq('id', userId);
  return { error: error?.message ?? null };
}
