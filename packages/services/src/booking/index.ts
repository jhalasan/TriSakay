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
  if (!data) return { error: 'Could not cancel — this ride may already be assigned or no longer active.' };
  return { error: null };
}

export interface AcceptRideRequestResult {
  error: string | null;
}

/**
 * Finds (or creates) the driver's active trip, then assigns the ride request
 * to it. The final update is guarded by `status = 'pending'` so a driver who
 * loses a race against another driver gets a clear error instead of silently
 * overwriting someone else's assignment.
 */
export async function acceptRideRequest(driverId: string, rideRequestId: string): Promise<AcceptRideRequestResult> {
  const client = getSupabaseClient();

  const { data: existingTrip, error: tripLookupError } = await client
    .from('trips')
    .select('id')
    .eq('driver_id', driverId)
    .eq('status', 'active')
    .maybeSingle();

  if (tripLookupError) return { error: tripLookupError.message };

  let tripId: string | undefined = existingTrip?.id;

  if (!tripId) {
    const { data: tricycle, error: tricycleError } = await client
      .from('tricycles')
      .select('id, seat_capacity')
      .eq('driver_id', driverId)
      .eq('is_active', true)
      .eq('verification_status', 'approved')
      .maybeSingle();

    if (tricycleError) return { error: tricycleError.message };
    if (!tricycle) return { error: 'No active tricycle assigned yet — finish vehicle verification first.' };

    const { data: newTrip, error: createTripError } = await client
      .from('trips')
      .insert({
        driver_id: driverId,
        tricycle_id: tricycle.id,
        max_seats: tricycle.seat_capacity,
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (createTripError) return { error: createTripError.message };
    tripId = newTrip.id;
  }

  const { data: assigned, error: assignError } = await client
    .from('ride_requests')
    .update({
      trip_id: tripId,
      status: 'assigned',
      assigned_at: new Date().toISOString(),
    })
    .eq('id', rideRequestId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (assignError) return { error: assignError.message };
  if (!assigned) return { error: 'This ride was just accepted by another driver.' };

  return { error: null };
}

export type RideRequestStatusUpdate = Pick<RideRequestRow, 'id' | 'status'>;

/**
 * First Realtime subscription in this codebase — one row, one channel, torn down by the returned unsubscribe.
 *
 * A `postgres_changes` subscription only forwards *future* events, so an
 * UPDATE that lands in the gap before the channel finishes joining (or
 * during a reconnect after a dropped socket) would otherwise be missed
 * forever. To close that gap, once the channel reports `'SUBSCRIBED'` we
 * run a one-off reconcile query and feed its result through the same
 * `onChange` callback — safe to always do, since the caller's own
 * status-branching logic already no-ops on a still-`'pending'` row.
 */
export function subscribeToRideRequestStatus(
  rideRequestId: string,
  onChange: (row: RideRequestStatusUpdate) => void,
  onError?: (message: string) => void,
): () => void {
  const client = getSupabaseClient();
  const channel = client
    .channel(`ride_request_status_${rideRequestId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'ride_requests', filter: `id=eq.${rideRequestId}` },
      (payload: { new: RideRequestStatusUpdate }) => onChange(payload.new),
    )
    .subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        client
          .from('ride_requests')
          .select('id, status')
          .eq('id', rideRequestId)
          .maybeSingle()
          .then(({ data }: { data: RideRequestStatusUpdate | null }) => {
            if (data) onChange(data);
          });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError?.('Lost connection while waiting for a driver. Please check your connection.');
      }
    });

  return () => {
    client.removeChannel(channel);
  };
}
