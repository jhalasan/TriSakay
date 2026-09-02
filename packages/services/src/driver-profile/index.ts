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

export interface DriverUnitResult {
  bodyNo: string | null;
  plateNo: string | null;
  mtopExpiryDate: string | null;
  verificationStatus: VerificationStatus | null;
  error: string | null;
}

/**
 * Backs the Dashboard identity row's "PSO verified · Body no. {n}" line and
 * Profile's Tricycle row / franchise card — body_no/plate_no/mtop_expiry_date
 * all live on `tricycles`, keyed by driver_id, not on driver_profiles.
 */
export async function getDriverUnit(): Promise<DriverUnitResult> {
  const userId = await getSignedInUserId();
  if (!userId) return { bodyNo: null, plateNo: null, mtopExpiryDate: null, verificationStatus: null, error: 'Not signed in' };

  const { data, error } = await getSupabaseClient()
    .from('tricycles')
    .select('body_no, plate_no, mtop_expiry_date, verification_status')
    .eq('driver_id', userId)
    .maybeSingle();

  if (error) return { bodyNo: null, plateNo: null, mtopExpiryDate: null, verificationStatus: null, error: error.message };
  return {
    bodyNo: data?.body_no ?? null,
    plateNo: data?.plate_no ?? null,
    mtopExpiryDate: data?.mtop_expiry_date ?? null,
    verificationStatus: data?.verification_status ?? null,
    error: null,
  };
}

/**
 * Reads `driver_profiles.rating_avg`/`rating_count` for the signed-in
 * driver — shown on both Dashboard's stat tile and Profile, so this is
 * hydrated once at app boot (see useRatingSync in app/_layout.tsx) rather
 * than duplicated as a per-screen fetch.
 */
export async function getDriverRatingSummary(): Promise<{
  ratingAvg: number | null;
  ratingCount: number;
  error: string | null;
}> {
  const userId = await getSignedInUserId();
  if (!userId) return { ratingAvg: null, ratingCount: 0, error: 'Not signed in' };

  const { data, error } = await getSupabaseClient()
    .from('driver_profiles')
    .select('rating_avg, rating_count')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { ratingAvg: null, ratingCount: 0, error: error.message };
  if (!data) return { ratingAvg: null, ratingCount: 0, error: null };

  return { ratingAvg: data.rating_avg, ratingCount: data.rating_count, error: null };
}

export interface DriverDailyEarning {
  date: string;
  ridesCompleted: number;
  totalCollected: number;
}

/**
 * Sums `v_driver_earnings.total_collected` (a security_invoker view — the
 * underlying `trips`/`transactions` RLS already scopes it to the caller's
 * own rows; `.eq('driver_id', userId)` is added anyway for clarity, matching
 * every other driver-scoped read in this file). Only counts rides whose
 * transaction actually reached `status = 'paid'` (the view's own join
 * condition), so a GCash ride the webhook hasn't confirmed yet is correctly
 * excluded — this is "tracked", not a promise of settled money.
 *
 * The view is already grouped one row per day (`earning_date`), so the same
 * query doubles as the chart's daily breakdown — no second round trip.
 */
export async function getDriverEarnings(): Promise<{
  totalTracked: number | null;
  breakdown: DriverDailyEarning[] | null;
  error: string | null;
}> {
  const userId = await getSignedInUserId();
  if (!userId) return { totalTracked: null, breakdown: null, error: 'Not signed in' };

  const { data, error } = await getSupabaseClient()
    .from('v_driver_earnings')
    .select('earning_date, rides_completed, total_collected')
    .eq('driver_id', userId)
    .order('earning_date', { ascending: true });

  if (error) return { totalTracked: null, breakdown: null, error: error.message };

  const rows = data ?? [];
  const totalTracked = rows.reduce((sum, row) => sum + (row.total_collected ?? 0), 0);
  const breakdown = rows.map((row) => ({
    date: row.earning_date ?? '',
    ridesCompleted: row.rides_completed ?? 0,
    totalCollected: row.total_collected ?? 0,
  }));

  return { totalTracked, breakdown, error: null };
}
