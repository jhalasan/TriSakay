import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

// distance_meters isn't a ride_requests column — match-ride-request adds it
// ad-hoc to each row only in its heuristic-applied branch (see
// supabase/functions/match-ride-request/index.ts), so it's optional here
// rather than part of the generated table type.
export type RideRequestRow = Database['public']['Tables']['ride_requests']['Row'] & {
  distance_meters?: number;
};

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

/**
 * Inserts the passenger's booking. `status` defaults to `'pending'`
 * server-side — no driver is assigned yet.
 *
 * Y8 (existing-system audit): `enforce_one_active_ride_request_per_passenger`
 * only ever checked this with an EXISTS query inside the insert trigger — no
 * unique constraint backed it, so two concurrent inserts for the same
 * passenger (two devices, or a retried request) could both pass that check
 * before either committed. `ride_requests_one_active_per_passenger` (a
 * partial unique index, 20260927000008) is the actual race-safe backstop;
 * the trigger still gives a friendly message on the common single-device
 * case, so a 23505 here reaching this far means the trigger's own check
 * raced and lost — same message either way.
 */
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

  if (error?.code === '23505') {
    return { data: null, error: 'You already have an active ride request.' };
  }

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
 * PD1 (UAT audit): calls the cancel_ride_request RPC, which enforces the
 * full stage gate server-side — 'pending' is free (reasonCode may be
 * omitted), 'assigned' requires a reasonCode and is recorded as a passenger
 * strike, anything else (e.g. 'ongoing') is rejected. Replaces X9's
 * cancel_ride_request_as_passenger, which only handled the RLS-loophole
 * fix, not the policy itself.
 */
export async function cancelRideRequest(
  rideRequestId: string,
  reasonCode?: string | null,
  reason?: string,
): Promise<CancelRideRequestResult> {
  const { error } = await getSupabaseClient().rpc('cancel_ride_request', {
    p_ride_request_id: rideRequestId,
    p_reason_code: reasonCode ?? undefined,
    p_reason: reason ?? undefined,
  });

  if (error) return { error: error.message };
  return { error: null };
}

export interface AcceptRideRequestResult {
  error: string | null;
  tripId?: string;
}

/**
 * F6 (UAT audit): a single-transaction RPC replaces what used to be several
 * separate client calls (find-or-create trip, then a guarded UPDATE). Locks
 * the ride row FOR UPDATE first — that lock is what makes "only one driver
 * wins" airtight, not just the status check — then locks-or-creates the
 * driver's trip FOR UPDATE (closing the old "same driver accepts two rides
 * at once" double-seat-check race) before checking free seats and assigning.
 * See the migration for the full account/availability/cluster/decline checks
 * it also carries forward from X11.
 */
export async function acceptRideRequest(rideRequestId: string): Promise<AcceptRideRequestResult> {
  const { data, error } = await getSupabaseClient().rpc('accept_ride_request', {
    p_ride_request_id: rideRequestId,
  });

  if (error) return { error: error.message };

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return { error: 'This ride was just accepted by another driver.' };

  return { error: null, tripId: row.trip_id };
}

/**
 * F6 (UAT audit): after a network error or client-side timeout wrapping
 * acceptRideRequest(), the RPC may already have committed server-side before
 * the response (or the timeout) reached this client — without this, a driver
 * who actually won would be told the opposite and left thinking they need to
 * retry. `rr_driver_read`'s own RLS makes this a safe, cheap check: a row
 * comes back only while it's still 'pending' (genuinely never accepted by
 * anyone) or while its trip belongs to the calling driver (this driver won);
 * another driver's win is invisible to this query, which is exactly the
 * signal needed — no row (or a still-pending row) means "you did not win."
 */
export async function reconcileAcceptedRide(rideRequestId: string): Promise<{ tripId: string | null }> {
  const { data } = await getSupabaseClient()
    .from('ride_requests')
    .select('status, trip_id')
    .eq('id', rideRequestId)
    .maybeSingle();

  if (data?.status === 'assigned' && data.trip_id) return { tripId: data.trip_id };
  return { tripId: null };
}

export interface DeclineRideRequestResult {
  error: string | null;
}

/**
 * Records that this driver declined a request (`driver_id = auth.uid()`,
 * enforced by `ride_request_declines_driver_insert`), so match-ride-request
 * excludes it from this driver's board going forward — including after a
 * relaunch, unlike the old in-memory-only dismissal. Idempotent: declining
 * the same request twice just no-ops the second insert rather than erroring,
 * since the (ride_request_id, driver_id) pair is the table's primary key.
 */
export async function declineRideRequest(driverId: string, rideRequestId: string): Promise<DeclineRideRequestResult> {
  const { error } = await getSupabaseClient()
    .from('ride_request_declines')
    .upsert({ ride_request_id: rideRequestId, driver_id: driverId }, { onConflict: 'ride_request_id,driver_id', ignoreDuplicates: true });

  return { error: error?.message ?? null };
}

export type RideRequestStatusUpdate = Pick<
  RideRequestRow,
  'id' | 'status' | 'cancel_reason' | 'cancelled_by' | 'discount_applied' | 'trip_id'
>;

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
          .select('id, status, cancel_reason, cancelled_by, discount_applied, trip_id')
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

/**
 * R6 (existing-system audit): the driver previously had no live signal for a
 * passenger cancelling mid-trip — `useTripStore.current` only ever refreshed
 * via an explicit `hydrate()` (app boot, or after the driver's own action).
 * Filters on `trip_id` rather than a single ride_request id since FR-2.5c
 * allows several passengers aboard the same trip at once; the caller is
 * expected to re-hydrate the whole trip on any change rather than try to
 * patch one row, since a cancellation touches several columns at once
 * (status, cancelled_at, cancel_reason, cancelled_by) and get_active_trip_passengers
 * is the single source of truth for what's still actually on the trip.
 */
export function subscribeToTripRideRequests(
  tripId: string,
  onChange: () => void,
  onError?: (message: string) => void,
): () => void {
  const client = getSupabaseClient();
  const channel = client
    .channel(`trip_ride_requests_${tripId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'ride_requests', filter: `trip_id=eq.${tripId}` },
      () => onChange(),
    )
    .subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        onChange();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError?.('Lost connection while tracking this trip. Pull to refresh if something looks off.');
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
 *
 * Y1 (existing-system audit): the RPC now enforces a ~300m-from-destination
 * check and a minimum-plausible-duration check, both with their own
 * descriptive messages — surfaced verbatim instead of a generic one, since a
 * rejected completion needs to tell the driver why (too far / too soon).
 */
export async function completeRideLeg(tripId: string, rideRequestId: string): Promise<CompleteRideLegResult> {
  const { error } = await getSupabaseClient().rpc('complete_ride_leg', {
    p_trip_id: tripId,
    p_ride_request_id: rideRequestId,
  });

  if (error) return { error: error.message };
  return { error: null };
}

export interface StartRideLegResult {
  error: string | null;
}

/**
 * Marks ONE passenger's leg picked up (assigned -> ongoing). Must precede
 * completeRideLeg for that same leg.
 *
 * Y1 (existing-system audit): the RPC now enforces a ~100m-from-pickup
 * check, surfaced verbatim for the same reason as completeRideLeg above.
 */
export async function startRideLeg(tripId: string, rideRequestId: string): Promise<StartRideLegResult> {
  const { error } = await getSupabaseClient().rpc('start_ride_leg', {
    p_trip_id: tripId,
    p_ride_request_id: rideRequestId,
  });

  if (error) return { error: error.message };
  return { error: null };
}

export interface MarkArrivedResult {
  error: string | null;
  arrivedAt: string | null;
}

/**
 * F4 (UAT audit): the driver's "I've arrived" tap. Idempotent server-side —
 * a second call for the same ride just returns the first call's timestamp
 * rather than erroring — and rejected by the RPC unless the driver's last
 * known position is within ~100m of the pickup point (L4).
 */
export async function markArrived(rideRequestId: string): Promise<MarkArrivedResult> {
  const { data, error } = await getSupabaseClient().rpc('mark_arrived', { p_ride_request_id: rideRequestId });

  if (error) return { error: error.message, arrivedAt: null };

  const row = Array.isArray(data) ? data[0] : null;
  return { error: null, arrivedAt: row?.arrived_at ?? null };
}

export interface CancelRideLegResult {
  error: string | null;
}

/**
 * Cancels ONE passenger's leg via the cancel_ride_leg RPC — same reasoning
 * as completeRideLeg above. PD1 (UAT audit): reasonCode is now required by
 * the RPC (it enforces the no-show wait/distance gate when reasonCode is
 * 'passenger_no_show') — surfaces the RPC's own descriptive error instead of
 * a generic one, since a rejected no-show needs to tell the driver why.
 */
export async function cancelRideLeg(tripId: string, rideRequestId: string, reasonCode: string, reason?: string): Promise<CancelRideLegResult> {
  const { error } = await getSupabaseClient().rpc('cancel_ride_leg', {
    p_trip_id: tripId,
    p_ride_request_id: rideRequestId,
    p_reason_code: reasonCode,
    p_reason: reason ?? undefined,
  });

  if (error) return { error: error.message };

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
  /** P1-14 (2026-09-15 launch audit): lets the active-trip map rehydrate its marker/route on app restart, same as a freshly-accepted request. */
  pickupLat: number | null;
  pickupLng: number | null;
  destLat: number | null;
  destLng: number | null;
  /** D2: the nearest-next-stop sort's overdue clock and ride distance. */
  assignedAt: string | null;
  pickedUpAt: string | null;
  distanceKm: number | null;
  /** F4: set once the driver taps "I've arrived" at this passenger's pickup point. */
  arrivedAt: string | null;
  /** D1: set only while an after-pickup transfer to this driver is accepted but not yet handoff-confirmed — the point to meet the previous driver, distinct from the ride's original pickup. */
  handoffLat: number | null;
  handoffLng: number | null;
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
        pickupLat: row.pickup_lat,
        pickupLng: row.pickup_lng,
        destLat: row.dest_lat,
        destLng: row.dest_lng,
        // `?? null`: until the D2/F4 migrations are applied live these columns are absent.
        assignedAt: row.assigned_at ?? null,
        pickedUpAt: row.picked_up_at ?? null,
        distanceKm: row.distance_km ?? null,
        arrivedAt: row.arrived_at ?? null,
        handoffLat: row.handoff_lat ?? null,
        handoffLng: row.handoff_lng ?? null,
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
  passengerAvatarUrl: string | null;
  status: 'completed' | 'cancelled';
  fare: number | null;
  date: string;
  pickup: string | null;
  dropoff: string | null;
  distanceKm: number | null;
  durationMinutes: number | null;
  seats: number | null;
  paymentMethod: 'cash' | 'gcash' | null;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | null;
  cancelReason: string | null;
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
 * Mirrors listPassengerTripHistory's route/payment/cancellation fields
 * (2026-09-22 follow-up to UAT D11) — the RPC reads from the same rows,
 * minus the passenger-only discount fields and the other-party identity
 * fields (driver rating/plate/body_no) that don't apply to a driver's own
 * history view.
 */
export async function listDriverTripHistory(limit = 50): Promise<ListDriverTripHistoryResult> {
  const { data, error } = await getSupabaseClient().rpc('get_driver_trip_history', { p_limit: limit });

  if (error) return { data: [], error: error.message };

  const rows = (data ?? []).map((row) => ({
    rideRequestId: row.ride_request_id,
    passengerName: row.passenger_name,
    passengerAvatarUrl: row.passenger_avatar_url,
    status: row.status as 'completed' | 'cancelled',
    fare: row.fare,
    date: row.completed_at ?? row.cancelled_at ?? row.requested_at,
    pickup: row.pickup_label,
    dropoff: row.dest_label,
    distanceKm: row.distance_km,
    durationMinutes: row.duration_minutes,
    seats: row.seats,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    cancelReason: row.cancel_reason,
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
