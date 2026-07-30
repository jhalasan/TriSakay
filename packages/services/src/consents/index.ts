import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types';

/**
 * Bumping either constant re-opens the consent gate for every user: the check
 * below compares these against the versions already recorded in
 * `public.user_consents`, so forcing re-consent is a one-line change here.
 */
export const CURRENT_TOS_VERSION = 'v1.0';
export const CURRENT_PRIVACY_VERSION = 'v1.0';

export type PolicyType = 'terms_of_service' | 'privacy_policy';

export type UserConsentRow = Database['public']['Tables']['user_consents']['Row'];
export type UserConsentInsert = Database['public']['Tables']['user_consents']['Insert'];

export interface ConsentStatus {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  bothAccepted: boolean;
}

async function getSignedInUserId(): Promise<string | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * Existence of a row at the current version is equivalent to "the most recent
 * acceptance is current": `user_consents` is append-only and versions only move
 * forward, so nothing can supersede a row already at the current version.
 *
 * Versions are compared in TypeScript rather than as a PostgREST `.or(and(...))`
 * filter — it keeps the constants out of a filter string, and the row set is a
 * handful of rows per user.
 */
export async function getConsentStatus(): Promise<{ status: ConsentStatus | null; error: string | null }> {
  const userId = await getSignedInUserId();
  if (!userId) return { status: null, error: 'Not signed in' };

  const { data, error } = await getSupabaseClient()
    .from('user_consents')
    .select('policy_type, policy_version')
    .eq('user_id', userId)
    .in('policy_type', ['terms_of_service', 'privacy_policy']);

  if (error) return { status: null, error: error.message };

  const rows = data ?? [];
  const hasAccepted = (policyType: PolicyType, version: string): boolean =>
    rows.some((row) => row.policy_type === policyType && row.policy_version === version);

  const termsAccepted = hasAccepted('terms_of_service', CURRENT_TOS_VERSION);
  const privacyAccepted = hasAccepted('privacy_policy', CURRENT_PRIVACY_VERSION);

  return {
    status: { termsAccepted, privacyAccepted, bothAccepted: termsAccepted && privacyAccepted },
    error: null,
  };
}

export async function recordConsent(): Promise<{ error: string | null }> {
  const userId = await getSignedInUserId();
  if (!userId) return { error: 'Not signed in' };

  // Both rows in one statement, so a dropped connection can never leave a user
  // consented to one policy and not the other. `accepted_at` is deliberately
  // omitted: the column's `default now()` uses the database clock, which is the
  // one worth defending in an audit — a client clock is trivially wrong.
  const rows: UserConsentInsert[] = [
    { user_id: userId, policy_type: 'terms_of_service', policy_version: CURRENT_TOS_VERSION },
    { user_id: userId, policy_type: 'privacy_policy', policy_version: CURRENT_PRIVACY_VERSION },
  ];

  const { error } = await getSupabaseClient().from('user_consents').insert(rows);
  return { error: error?.message ?? null };
}
