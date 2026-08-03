# Driver app: real ride requests (design)

**Date:** 2026-08-04
**Scope:** `apps/driver`, `packages/services/src/booking`

## Problem

`apps/driver/src/store/useRequestsStore.ts` currently invents ride requests on a
random timer (`startSimulatingArrivals`) instead of reading real `ride_requests`
rows. The passenger app already inserts real rows (`createRideRequest`, see
`docs/superpowers/specs/2026-08-02-ride-request-insert-design.md`), but nothing
on the driver side queries or subscribes to them, and nothing writes an accept
back to the database. This is `docs/DRIVER_TODO.MD` items #7/#8.

Real bearing/detour/cluster matching depends on a `match-ride-request` Edge
Function that doesn't exist yet (tracked as `docs/DRIVER_TODO.MD` open item
#1). Per that doc's own stated plan, this task builds the request board against
a **naive query** (every pending request, no filtering) and defers real
matching to when that Edge Function exists.

## Out of scope (unchanged)

`useTripStore`, the active-trip screen, trip completion, cash confirmation,
`useDriverStore.isAvailable` persistence, earnings, and history all stay
exactly as they are today — local mock state, not wired to Supabase. Accepting
a request still hands off to the existing mocked `useTripStore.startTrip`.

## Data flow

1. Passenger inserts a `ride_requests` row (`status: 'pending'`) — already built.
2. Every online driver's Realtime subscription fires.
3. The store refetches the full pending list and re-renders the request board
   with real pickup/dropoff labels and fare (previously always `null`/random).
4. Driver taps Accept.
5. The service finds-or-creates the driver's active `trips` row, then updates
   the `ride_requests` row to `trip_id` / `status: 'assigned'` / `assigned_at`,
   guarded by `status = 'pending'` so a losing driver in a race gets zero rows
   back instead of silently overwriting someone else's assignment.
6. The request disappears from every driver's board on their next refetch.
7. `useTripStore.startTrip(request)` runs unchanged from here.

## Service layer (`packages/services/src/booking/index.ts`)

### `subscribeToPendingRideRequests(onData, onError?)`

- Opens one Realtime channel on `ride_requests`, listening to all
  `postgres_changes` events (insert/update/delete), no column filter.
- On every event, and once when the channel reports `SUBSCRIBED`, it runs
  `select * from ride_requests where status = 'pending' order by requested_at
  asc` and passes the full array to `onData`.
- Refetching the whole list on any event (rather than patching from the
  payload) sidesteps relying on exactly which rows RLS lets this event through
  for — the same category of gap `subscribeToRideRequestStatus` already works
  around with its post-`SUBSCRIBED` reconcile query.
- `onError` is called on `CHANNEL_ERROR`/`TIMED_OUT`, same wording pattern as
  `subscribeToRideRequestStatus`.
- Returns an unsubscribe function that calls `removeChannel`.

### `acceptRideRequest(driverId, rideRequestId): Promise<{ error: string | null }>`

1. `select * from trips where driver_id = driverId and status = 'active'
   limit 1 maybeSingle()`.
2. If none found: `select * from tricycles where driver_id = driverId and
   is_active = true and verification_status = 'approved' limit 1
   maybeSingle()`.
   - No row → return `{ error: 'No active tricycle assigned yet — finish
     vehicle verification first.' }` without touching the ride request.
   - Row found → `insert into trips { driver_id, tricycle_id, max_seats:
     tricycle.seat_capacity, status: 'active', started_at: now() }
     .select().single()`.
3. `update ride_requests set trip_id, status = 'assigned', assigned_at =
   now() where id = rideRequestId and status = 'pending' .select().maybeSingle()`.
   - Postgres error → return `{ error: error.message }`.
   - No row returned (lost the race, or already gone) → return `{ error: 'This
     ride was just accepted by another driver.' }`.
   - Success → `{ error: null }`.

## `apps/driver/src/store/useRequestsStore.ts`

- Deletes `startSimulatingArrivals`, `stopSimulatingArrivals`,
  `createPlaceholderRequest`, the epoch counter, and the now-unused
  `src/mocks/delay.ts`.
- New shape:
  ```ts
  interface RequestsState {
    pending: PendingRequest[];
    error: string | null;
    subscribe: (driverId: string) => void;
    unsubscribe: () => void;
    accept: (id: string, driverId: string) => Promise<PendingRequest | undefined>;
    decline: (id: string) => void;
  }
  ```
- `subscribe(driverId)` calls `subscribeToPendingRideRequests`, mapping each
  `RideRequestRow` to the existing `PendingRequest` shape (`pickupLabel:
  row.pickup_label`, `dropoffLabel: row.dest_label`, `fare:
  row.estimated_fare`, etc.), filtering out any id present in a session-only
  `dismissed` set before storing into `pending`. Stores the unsubscribe
  function returned by the service call.
- `unsubscribe()` calls the stored unsubscribe function (no-op if not
  subscribed) and clears `pending`.
- `decline(id)` stays local-only — there's no per-driver-rejection column in
  the schema, a decline is just "don't show me this one again" — but now also
  adds `id` to the `dismissed` set so it doesn't reappear on the next
  realtime-triggered refetch while this driver stays online. `dismissed`
  resets on `unsubscribe()`.
- `accept(id, driverId)` looks up the local request, calls
  `acceptRideRequest(driverId, id)`, and:
  - on error: sets `error` on the store, returns `undefined`, leaves `pending`
    untouched (the next refetch will reconcile it either way).
  - on success: removes it from `pending`, clears `error`, returns the
    request.

## Screens

- `dashboard.tsx`: `handleToggleAvailable` calls `subscribe(user.id)` /
  `unsubscribe()` instead of the old simulate methods. `handleAccept` becomes
  `async`, awaits `accept(id, user.id)`, and only navigates to `/trip/active`
  when a request comes back; otherwise the store's `error` renders as inline
  text under the incoming-request card (same visual pattern as the login
  screen's inline auth error).
- `requests.tsx`: same `async`/error-surfacing change to `handleAccept`.
- `logout.tsx`: calls `unsubscribe()` instead of `stopSimulatingArrivals()`.

## Testing

- `packages/services/tests/booking.test.ts`: add cases for
  `acceptRideRequest` (reuses existing active trip; creates a trip from the
  driver's tricycle; no-tricycle error; lost-race error; Postgres error
  passthrough) and `subscribeToPendingRideRequests` (refetches on event,
  reconciles on `SUBSCRIBED`, forwards channel errors, unsubscribe calls
  `removeChannel`) — following the existing `fakeSupabaseClient` pattern.
- `apps/driver/tests/requestsStore.test.js`: drop the epoch/setTimeout
  simulation tests (no longer applicable). Keep/adapt the accept-removes-from-
  pending and decline-removes-from-pending assertions against the new async
  `accept`, and add a case that a declined id doesn't come back after a
  simulated refetch.
