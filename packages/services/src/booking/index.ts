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

export interface ActiveRideRequest {
  id: string;
  status: Database['public']['Enums']['ride_status'];
  pickupLabel: string | null;
  pickupLat: number;
  pickupLng: number;
  destLabel: string | null;
  destLat: number;
  destLng: number;
  seats: number;
  estimatedFare: number | null;
  preferredMethod: Database['public']['Enums']['payment_method'];
}

export interface GetActiveRideResult {
  data: ActiveRideRequest | null;
  error: string | null;
}

/**
 * Finds the passenger's own most recent `pending`/`assigned`/`ongoing` ride
 * request, if any — used to re-hydrate `useBookingStore` on app boot. Without
 * this, a passenger whose app restarts mid-ride (backgrounded, crashed,
 * force-quit) would land on a blank booking store and could start an
 * entirely new booking while the backend still has their old ride active.
 * Stops at `ongoing`, not `completed` — payment/rating recovery across a
 * restart is a separate, already-tracked gap (both are still mock/local on
 * this screen), not part of what this function exists to fix. `ongoing` is
 * included because, unlike the old `assigned -> completed` transition, a ride
 * now spends its entire in-tricycle duration in `ongoing` — excluding it here
 * would drop a passenger's trip screen for the whole ride, not just an
 * instant.
 */
export async function getActiveRideForPassenger(passengerId: string): Promise<GetActiveRideResult> {
  const { data, error } = await getSupabaseClient()
    .from('ride_requests')
    .select(
      'id, status, pickup_label, pickup_lat, pickup_lng, dest_label, dest_lat, dest_lng, seats_requested, estimated_fare, preferred_method'
    )
    .eq('passenger_id', passengerId)
    .in('status', ['pending', 'assigned', 'ongoing'])
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };

  return {
    data: {
      id: data.id,
      status: data.status,
      pickupLabel: data.pickup_label,
      pickupLat: data.pickup_lat,
      pickupLng: data.pickup_lng,
      destLabel: data.dest_label,
      destLat: data.dest_lat,
      destLng: data.dest_lng,
      seats: data.seats_requested,
      estimatedFare: data.estimated_fare,
      preferredMethod: data.preferred_method,
    },
    error: null,
  };
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
  tripId?: string;
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

  if (tripLookupError) return { error: "Couldn't check your active trips. Please try again." };

  let tripId: string | undefined = existingTrip?.id;

  if (!tripId) {
    const { data: tricycle, error: tricycleError } = await client
      .from('tricycles')
      .select('id, seat_capacity')
      .eq('driver_id', driverId)
      .eq('is_active', true)
      .eq('verification_status', 'approved')
      .maybeSingle();

    if (tricycleError) return { error: "Couldn't check your vehicle assignment. Please try again." };
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

    if (createTripError) {
      // 23505 = unique_violation on trips_one_active_per_driver: a concurrent
      // accept (double-tap, or Dashboard + Requests tab racing) already
      // created this driver's active trip between the lookup above and this
      // insert. That other call is the one that "won" — use its trip instead
      // of failing outright, so a double-tap still results in one accepted
      // ride rather than a stuck error.
      if (createTripError.code === '23505') {
        const { data: raceWinnerTrip, error: raceLookupError } = await client
          .from('trips')
          .select('id')
          .eq('driver_id', driverId)
          .eq('status', 'active')
          .maybeSingle();

        if (raceLookupError || !raceWinnerTrip) {
          return { error: "Couldn't start a new trip. Please try again." };
        }
        tripId = raceWinnerTrip.id;
      } else {
        return { error: "Couldn't start a new trip. Please try again." };
      }
    } else {
      tripId = newTrip.id;
    }
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

  if (assignError) return { error: "Couldn't assign this ride. Please try again." };
  if (!assigned) return { error: 'This ride was just accepted by another driver.' };

  return { error: null, tripId };
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

/** Collapses a burst of change events (one per passenger action, system-wide) into a single Edge Function call. */
const PENDING_REQUESTS_REFETCH_DEBOUNCE_MS = 500;

/**
 * Request-board feed, filtered/ranked server-side by the `match-ride-request`
 * Edge Function (FR-2.5: cluster-authorization hard filter, then a
 * bearing-tolerance/detour-ratio soft filter once the driver has a known
 * position — see that function's own header comment for the full heuristic).
 *
 * Refetches (re-invokes the Edge Function) on every change event instead of
 * patching from the payload, since RLS/the heuristic can silently drop a row
 * from this driver's view mid-stream (e.g. once another driver claims it, or
 * the driver's own route no longer matches) — the same category of gap
 * `subscribeToRideRequestStatus` above works around with its post-SUBSCRIBED
 * reconcile query. The subscription is unfiltered (every row in the table,
 * not just this driver's matches), so change-triggered refetches are
 * debounced — the initial post-SUBSCRIBED refetch is not, callers expect
 * the first page of results right away.
 */
/**
 * The Functions SDK's own `error.message` is always the generic "Edge
 * Function returned a non-2xx status code" — it never surfaces the JSON
 * body our own function actually returned. `error.context` is the raw
 * `Response`, so read it directly for the real reason. A 401 here means the
 * driver's session was invalidated (e.g. signed out on another device) even
 * though its access token hadn't reached its own expiry yet — a plain
 * re-login clears it, so that's what the driver is told to do instead of a
 * raw technical string.
 */
async function describePendingRequestsError(error: { context?: unknown }): Promise<string> {
  if (error.context instanceof Response) {
    try {
      const body = (await error.context.json()) as { error?: string | null };
      if (body?.error === 'Not authenticated' || body?.error === 'Missing Authorization header') {
        return 'Your session expired. Please log out and log back in.';
      }
    } catch {
      // Response body wasn't JSON — fall through to the generic message.
    }
  }
  return "Couldn't load ride requests. Please check your connection and try again.";
}

export function subscribeToPendingRideRequests(
  driverId: string,
  onData: (rows: RideRequestRow[]) => void,
  onError?: (message: string) => void,
): () => void {
  const client = getSupabaseClient();
  let cancelled = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function refetch() {
    const { data, error } = await client.functions.invoke('match-ride-request', { body: { driverId } });

    if (cancelled) return;
    if (error) {
      onError?.(await describePendingRequestsError(error));
      return;
    }

    const result = data as { data: RideRequestRow[] | null; error: string | null };
    if (result.error) {
      onError?.(result.error);
      return;
    }

    onData(result.data ?? []);
  }

  function scheduleRefetch() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void refetch();
    }, PENDING_REQUESTS_REFETCH_DEBOUNCE_MS);
  }

  const channel = client
    .channel('pending_ride_requests')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_requests' }, () => {
      scheduleRefetch();
    })
    .subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        void refetch();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (!cancelled) onError?.('Lost connection while listening for ride requests. Please check your connection.');
      }
    });

  return () => {
    cancelled = true;
    if (debounceTimer) clearTimeout(debounceTimer);
    client.removeChannel(channel);
  };
}

export interface CompleteRideLegResult {
  error: string | null;
}

/**
 * FR-2.5c mid-trip pickup — closes out ONE passenger's leg via the
 * complete_ride_leg RPC, leaving the trip itself (and any other passenger
 * still aboard) untouched. Replaces the old completeTrip(), which forced the
 * whole trip to completed together with its one ride request — that only
 * ever worked because a trip could hold exactly one passenger at a time; now
 * that acceptRideRequest() can attach multiple, ending the whole trip on any
 * one passenger's drop-off would have force-ended everyone else's ride too.
 * See end_trip() below for closing the trip session itself.
 */
export async function completeRideLeg(tripId: string, rideRequestId: string): Promise<CompleteRideLegResult> {
  const { error } = await getSupabaseClient().rpc('complete_ride_leg', {
    p_trip_id: tripId,
    p_ride_request_id: rideRequestId,
  });

  if (error) return { error: "Couldn't close out this passenger's ride. Please try again." };
  return { error: null };
}

export interface StartRideLegResult {
  error: string | null;
}

/** Marks ONE passenger's leg picked up (assigned -> ongoing). Must precede completeRideLeg for that same leg. */
export async function startRideLeg(tripId: string, rideRequestId: string): Promise<StartRideLegResult> {
  const { error } = await getSupabaseClient().rpc('start_ride_leg', {
    p_trip_id: tripId,
    p_ride_request_id: rideRequestId,
  });

  if (error) return { error: "Couldn't start this passenger's ride. Please try again." };
  return { error: null };
}

export interface CancelRideLegResult {
  error: string | null;
}

/** Cancels ONE passenger's leg via the cancel_ride_leg RPC — same reasoning as completeRideLeg above. */
export async function cancelRideLeg(tripId: string, rideRequestId: string, reason: string): Promise<CancelRideLegResult> {
  const { error } = await getSupabaseClient().rpc('cancel_ride_leg', {
    p_trip_id: tripId,
    p_ride_request_id: rideRequestId,
    p_reason: reason,
  });

  if (error) return { error: "Couldn't cancel this passenger's ride. Please try again." };

  return { error: null };
}

export interface EndTripResult {
  error: string | null;
}

/**
 * The driver's explicit "done for now" action (FR-2.5c). `trips.status =
 * 'active'` means "out working," independent of current passenger count —
 * this RPC is the only thing that ends it, and the DB itself refuses (not
 * just the UI disabling the button) while any passenger is still
 * assigned/ongoing on the trip.
 */
export async function endTrip(tripId: string): Promise<EndTripResult> {
  const { error } = await getSupabaseClient().rpc('end_trip', { p_trip_id: tripId });

  if (error) return { error: error.message };
  return { error: null };
}

export interface ActiveTripPassenger {
  rideRequestId: string;
  seats: number;
  paymentMethod: Database['public']['Enums']['payment_method'];
  fare: number | null;
  passengerId: string;
  passengerName: string | null;
  passengerAvatarUrl: string | null;
  cashConfirmed: boolean;
  status: Database['public']['Enums']['ride_status'];
}

export interface ActiveTripForDriver {
  tripId: string;
  startedAt: string;
  passengers: ActiveTripPassenger[];
}

export interface GetActiveTripForDriverResult {
  data: ActiveTripForDriver | null;
  error: string | null;
}

/**
 * Rehydrates a driver's in-progress trip on app boot. Without this, an app
 * restart mid-trip (killed by the OS, force-quit) leaves the client with no
 * memory of the trip while the backend still has it `active` — the driver
 * could never complete/cancel it from the UI, and acceptRideRequest's
 * active-trip check would keep blocking them from accepting anything new.
 *
 * Two calls, not one: get_active_trip_for_driver() returns just the trip
 * "header" (0 or 1 row); if a trip exists, get_active_trip_passengers()
 * returns every currently assigned/ongoing leg on it (0..N rows — an active
 * trip can have nobody aboard right now, per FR-2.5c's "stay parked between
 * pickups" model). A single combined call couldn't represent that: zero
 * passenger rows would be indistinguishable from no active trip at all.
 * No active trip is a normal state, returned as `{ data: null, error: null }`.
 */
export async function getActiveTripForDriver(): Promise<GetActiveTripForDriverResult> {
  const { data: tripRows, error: tripError } = await getSupabaseClient().rpc('get_active_trip_for_driver');
  if (tripError) return { data: null, error: tripError.message };

  const trip = Array.isArray(tripRows) ? tripRows[0] : null;
  if (!trip) return { data: null, error: null };

  const { data: passengerRows, error: passengersError } = await getSupabaseClient().rpc('get_active_trip_passengers', {
    p_trip_id: trip.trip_id,
  });
  if (passengersError) return { data: null, error: passengersError.message };

  return {
    data: {
      tripId: trip.trip_id,
      startedAt: trip.started_at,
      passengers: (passengerRows ?? []).map((row) => ({
        rideRequestId: row.ride_request_id,
        seats: row.seats_requested,
        paymentMethod: row.preferred_method,
        fare: row.estimated_fare,
        passengerId: row.passenger_id,
        passengerName: row.passenger_name,
        passengerAvatarUrl: row.avatar_url,
        cashConfirmed: row.cash_confirmed,
        status: row.status,
      })),
    },
    error: null,
  };
}

export interface TripDriverInfo {
  driverId: string;
  driverName: string | null;
  avatarUrl: string | null;
  plateNo: string | null;
  ratingAvg: number | null;
  ratingCount: number;
}

export interface GetTripDriverInfoResult {
  data: TripDriverInfo | null;
  error: string | null;
}

/**
 * Calls the `get_trip_driver_info` RPC (security definer — the passenger has
 * no direct read access to `trips`/`driver_profiles`/`tricycles`/other users'
 * `users` rows, so this is the only path to the assigned driver's info).
 * An empty result set (ride not found/owned/assigned yet) is a normal state,
 * returned as `{ data: null, error: null }`, not surfaced as an error.
 */
export async function getTripDriverInfo(rideRequestId: string): Promise<GetTripDriverInfoResult> {
  const { data, error } = await getSupabaseClient().rpc('get_trip_driver_info', {
    p_ride_request_id: rideRequestId,
  });

  if (error) return { data: null, error: error.message };

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return { data: null, error: null };

  return {
    data: {
      driverId: row.driver_id,
      driverName: row.driver_name,
      avatarUrl: row.avatar_url,
      plateNo: row.plate_no,
      ratingAvg: row.rating_avg,
      ratingCount: row.rating_count,
    },
    error: null,
  };
}

export interface DriverTripHistoryItem {
  rideRequestId: string;
  passengerName: string | null;
  status: 'completed' | 'cancelled';
  fare: number | null;
  date: string;
}

export interface ListDriverTripHistoryResult {
  data: DriverTripHistoryItem[];
  error: string | null;
}

/**
 * Calls the `get_driver_trip_history` RPC (security definer — a driver has
 * no direct RLS read on other users' `users` rows, so bulk passenger names
 * need the same server-side join trick as getTripPassengerInfo above, just
 * for a list instead of one row). The function itself scopes results to
 * `auth.uid()`'s own trips and only 'completed'/'cancelled' ride requests.
 */
export async function listDriverTripHistory(limit = 50): Promise<ListDriverTripHistoryResult> {
  const { data, error } = await getSupabaseClient().rpc('get_driver_trip_history', { p_limit: limit });

  if (error) return { data: [], error: error.message };

  const rows = (data ?? []).map((row) => ({
    rideRequestId: row.ride_request_id,
    passengerName: row.passenger_name,
    status: row.status as 'completed' | 'cancelled',
    fare: row.fare,
    date: row.completed_at ?? row.cancelled_at ?? row.requested_at,
  }));

  return { data: rows, error: null };
}

export interface TripPassengerInfo {
  passengerId: string;
  passengerName: string | null;
  avatarUrl: string | null;
}

export interface GetTripPassengerInfoResult {
  data: TripPassengerInfo | null;
  error: string | null;
}

/**
 * Calls the `get_trip_passenger_info` RPC (security definer — a driver has
 * no direct RLS read on another user's `users` row, so this is the only
 * path to the matched passenger's info). Mirrors getTripDriverInfo above,
 * just reversed: the function itself checks that the caller is the trip's
 * assigned driver before returning anything. An empty result set (ride not
 * found/not this driver's trip) is a normal state, not an error.
 */
export async function getTripPassengerInfo(rideRequestId: string): Promise<GetTripPassengerInfoResult> {
  const { data, error } = await getSupabaseClient().rpc('get_trip_passenger_info', {
    p_ride_request_id: rideRequestId,
  });

  if (error) return { data: null, error: error.message };

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return { data: null, error: null };

  return {
    data: {
      passengerId: row.passenger_id,
      passengerName: row.passenger_name,
      avatarUrl: row.avatar_url,
    },
    error: null,
  };
}
