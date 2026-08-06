import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export type VerificationStatus = Database['public']['Enums']['verification_status'];

async function getSignedInUserId(): Promise<string | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * A missing row (the auto-provisioning trigger hasn't landed yet, or ran
 * before this read) is reported as 'unsubmitted' rather than null/error —
 * callers gate app entry on this, and "no row" must fail closed the same
 * way an explicit 'unsubmitted' does.
 */
export async function getDriverVerificationStatus(): Promise<{
  status: VerificationStatus | null;
  error: string | null;
}> {
  const userId = await getSignedInUserId();
  if (!userId) return { status: null, error: 'Not signed in' };

  const { data, error } = await getSupabaseClient()
    .from('driver_profiles')
    .select('verification_status')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { status: null, error: error.message };
  if (!data) return { status: 'unsubmitted', error: null };

  return { status: data.verification_status, error: null };
}
