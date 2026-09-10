import { getSupabaseClient } from '../supabase/client.ts';

export interface FlaggedLowRatingRow {
  driverId: string;
  fullName: string;
  plateNo: string | null;
  ratingAvg: number;
  ratingCount: number;
  tripCount: number;
  accountStatus: 'active' | 'flagged' | 'suspended' | 'deactivated';
}

export interface ListFlaggedLowRatingsResult {
  data: FlaggedLowRatingRow[];
  error: string | null;
}

/**
 * Reads v_flagged_low_ratings (docs/SCHEMA.MD ~L1180) — rating_count >= 5 and
 * rating_avg below system_settings.low_rating_threshold. Read-only; there is
 * no write path for FR-10.3/10.4 yet. Tricycle plate, trip tally and account
 * status are merged client-side the same "no multi-hop embed" way
 * admin/drivers.ts's listDriversForAdmin() does — this view only carries the
 * three columns the flagging rule itself needs.
 */
export async function listFlaggedLowRatings(): Promise<ListFlaggedLowRatingsResult> {
  const client = getSupabaseClient();
  const { data, error } = await client.from('v_flagged_low_ratings').select('*').order('rating_avg', { ascending: true });

  if (error) return { data: [], error: error.message };
  if (!data || data.length === 0) return { data: [], error: null };

  const driverIds = data.map((row) => row.driver_id!);

  const [
    { data: users, error: usersError },
    { data: tricycles, error: tricyclesError },
    { data: trips, error: tripsError },
  ] = await Promise.all([
    client.from('users').select('id, status').in('id', driverIds),
    client.from('tricycles').select('driver_id, plate_no').in('driver_id', driverIds).eq('is_active', true),
    client.from('trips').select('driver_id').in('driver_id', driverIds),
  ]);

  if (usersError) return { data: [], error: usersError.message };
  if (tricyclesError) return { data: [], error: tricyclesError.message };
  if (tripsError) return { data: [], error: tripsError.message };

  const statusById = new Map((users ?? []).map((u) => [u.id, u.status]));
  const plateByDriverId = new Map((tricycles ?? []).map((t) => [t.driver_id, t.plate_no]));
  const tripCountByDriverId = new Map<string, number>();
  for (const t of trips ?? []) tripCountByDriverId.set(t.driver_id, (tripCountByDriverId.get(t.driver_id) ?? 0) + 1);

  const rows: FlaggedLowRatingRow[] = data.map((row) => ({
    driverId: row.driver_id!,
    fullName: row.full_name!,
    plateNo: plateByDriverId.get(row.driver_id!) ?? null,
    ratingAvg: Number(row.rating_avg),
    ratingCount: row.rating_count!,
    tripCount: tripCountByDriverId.get(row.driver_id!) ?? 0,
    accountStatus: (statusById.get(row.driver_id!) as FlaggedLowRatingRow['accountStatus'] | undefined) ?? 'active',
  }));

  return { data: rows, error: null };
}

export interface GetFleetRatingAverageResult {
  data: number | null;
  error: string | null;
}

/**
 * "Fleet average" for the *How this list is built* panel (README §08) — the
 * count-weighted mean across every driver with at least one rating, which
 * works out to the true average across all individual ratings (each
 * driver's own rating_avg is itself a mean of rating_count ratings).
 */
export async function getFleetRatingAverage(): Promise<GetFleetRatingAverageResult> {
  const client = getSupabaseClient();
  const { data, error } = await client.from('driver_profiles').select('rating_avg, rating_count').gt('rating_count', 0);

  if (error) return { data: null, error: error.message };

  const rows = data ?? [];
  const totalRatings = rows.reduce((sum, r) => sum + r.rating_count, 0);
  if (totalRatings === 0) return { data: null, error: null };

  const weightedSum = rows.reduce((sum, r) => sum + Number(r.rating_avg) * r.rating_count, 0);
  return { data: weightedSum / totalRatings, error: null };
}
