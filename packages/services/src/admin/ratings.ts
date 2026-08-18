import { getSupabaseClient } from '../supabase/client.ts';

export interface FlaggedLowRatingRow {
  driverId: string;
  fullName: string;
  ratingAvg: number;
  ratingCount: number;
}

export interface ListFlaggedLowRatingsResult {
  data: FlaggedLowRatingRow[];
  error: string | null;
}

/** Reads v_flagged_low_ratings (docs/SCHEMA.MD ~L1180) — rating_count >= 5 and rating_avg below system_settings.low_rating_threshold. Read-only; there is no write path for FR-10.3/10.4 yet. */
export async function listFlaggedLowRatings(): Promise<ListFlaggedLowRatingsResult> {
  const client = getSupabaseClient();
  const { data, error } = await client.from('v_flagged_low_ratings').select('*').order('rating_avg', { ascending: true });

  if (error) return { data: [], error: error.message };

  const rows = (data ?? []).map((row) => ({
    driverId: row.driver_id!,
    fullName: row.full_name!,
    ratingAvg: Number(row.rating_avg),
    ratingCount: row.rating_count!,
  }));

  return { data: rows, error: null };
}
