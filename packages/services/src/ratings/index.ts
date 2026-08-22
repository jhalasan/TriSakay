import { getSupabaseClient } from '../supabase/client.ts';

async function getSignedInUserId(): Promise<string | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * Translates the `validate_rating()` trigger's exceptions (docs/SCHEMA.MD §4.6)
 * into passenger-facing copy. None of the three should be reachable from this
 * app's own UI (the ride is only ever navigable when completed, and driverId
 * comes from the same RPC that populated the trip) — generic copy is enough
 * for the two that would indicate a real bug rather than a user-facing state.
 * Any other error (network, unexpected RLS) passes through as-is.
 */
function toFriendlyMessage(error: { message: string; code?: string }): string | null {
  if (error.code === '23505' || error.message.includes('ratings_ride_request_id_key')) {
    // Already rated — nothing wrong to report.
    return null;
  }
  if (error.message.includes('Cannot rate a ride that is not completed')) {
    return "This ride isn't marked complete yet — please try again in a moment.";
  }
  if (
    error.message.includes("Rating must be submitted by the ride's own passenger") ||
    error.message.includes('Rating must name the driver who actually drove this trip')
  ) {
    return 'Something went wrong — please try again.';
  }
  return error.message;
}

export interface SubmitRatingInput {
  rideRequestId: string;
  driverId: string;
  stars: number;
  comment?: string;
}

export interface SubmitRatingResult {
  error: string | null;
}

/**
 * Inserts a rating as the signed-in passenger (`passenger_id = auth.uid()`,
 * enforced by the `ratings_passenger_insert` RLS policy). `driver_profiles`'s
 * rating_avg/rating_count are recomputed server-side by trg_ratings_refresh —
 * nothing here touches them directly.
 */
export async function submitRating({
  rideRequestId,
  driverId,
  stars,
  comment,
}: SubmitRatingInput): Promise<SubmitRatingResult> {
  try {
    const userId = await getSignedInUserId();
    if (!userId) return { error: 'Not signed in' };

    const { error } = await getSupabaseClient()
      .from('ratings')
      .insert({
        ride_request_id: rideRequestId,
        passenger_id: userId,
        driver_id: driverId,
        stars,
        comment: comment?.trim() || null,
      });

    if (error) return { error: toFriendlyMessage(error) };
    return { error: null };
  } catch {
    return { error: 'Something went wrong — please try again.' };
  }
}

export interface DriverRatingEntry {
  id: string;
  rideRequestId: string;
  stars: number;
  comment: string | null;
  createdAt: string;
}

export interface ListDriverRatingsResult {
  data: DriverRatingEntry[];
  error: string | null;
}

/**
 * Reads the signed-in driver's own individual ratings directly — unlike trip
 * history or passenger info, `ratings_read` RLS already permits `driver_id =
 * auth.uid()` (docs/SCHEMA.MD §7.7), so this needs no security-definer RPC.
 * No passenger name is surfaced: FR-10 only requires the running average be
 * visible to the driver — per-rating passenger identity was never in scope.
 */
export async function listMyRatingsAsDriver(limit = 50): Promise<ListDriverRatingsResult> {
  const userId = await getSignedInUserId();
  if (!userId) return { data: [], error: 'Not signed in' };

  const { data, error } = await getSupabaseClient()
    .from('ratings')
    .select('id, ride_request_id, stars, comment, created_at')
    .eq('driver_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: error.message };

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      rideRequestId: row.ride_request_id,
      stars: row.stars,
      comment: row.comment,
      createdAt: row.created_at,
    })),
    error: null,
  };
}
