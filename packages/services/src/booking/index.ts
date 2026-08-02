import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export type RideRequestRow = Database['public']['Tables']['ride_requests']['Row'];

export interface CreateRideRequestInput {
  passengerId: string;
  pickup: { latitude: number; longitude: number; label: string };
  dropoff: { latitude: number; longitude: number; label: string };
  seats: number;
  distanceKm: number;
  estimatedFare: number;
  preferredMethod: Database['public']['Enums']['payment_method'];
  discountApplied: boolean;
  discountPercent: number | null;
}

export interface CreateRideRequestResult {
  data: RideRequestRow | null;
  error: string | null;
}

/** Inserts the passenger's booking. `status` defaults to `'pending'` server-side — no driver is assigned yet. */
export async function createRideRequest(input: CreateRideRequestInput): Promise<CreateRideRequestResult> {
  const { data, error } = await getSupabaseClient()
    .from('ride_requests')
    .insert({
      passenger_id: input.passengerId,
      pickup_lat: input.pickup.latitude,
      pickup_lng: input.pickup.longitude,
      pickup_label: input.pickup.label,
      dest_lat: input.dropoff.latitude,
      dest_lng: input.dropoff.longitude,
      dest_label: input.dropoff.label,
      seats_requested: input.seats,
      distance_km: input.distanceKm,
      estimated_fare: input.estimatedFare,
      preferred_method: input.preferredMethod,
      discount_applied: input.discountApplied,
      discount_percent: input.discountPercent,
    })
    .select()
    .single();

  return { data: data ?? null, error: error?.message ?? null };
}

export interface CancelRideRequestResult {
  error: string | null;
}

/**
 * Only succeeds while the row is still `pending` — enforced server-side by
 * the `rr_passenger_cancel` RLS policy, not re-checked here. A row RLS
 * silently excludes (e.g. already assigned) comes back as `data: null` with
 * no Postgres error, so that case is surfaced as a plain message rather than
 * reported as success.
 */
export async function cancelRideRequest(rideRequestId: string, reason: string): Promise<CancelRideRequestResult> {
  const { data, error } = await getSupabaseClient()
    .from('ride_requests')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason,
    })
    .eq('id', rideRequestId)
    .select()
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: 'Could not cancel — this ride may already be assigned.' };
  return { error: null };
}
