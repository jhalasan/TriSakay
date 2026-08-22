# Mid-trip Pickup (FR-2.5c) — Design

**Scope:** `apps/driver`, `packages/services`, plus one DB migration. No passenger or admin app changes.

Cross-reference: `docs/CONTEXT.MD` FR-2.5a–e, FR-9.2a; `docs/DRIVER_TODO.MD` item 10.

## What already works (confirmed by reading the live code/DB directly)

- The deployed `match-ride-request` Edge Function already detects the driver's active trip and matches new pending requests against *its* route/capacity, not the tricycle's declared route.
- `acceptRideRequest()` already attaches a newly-accepted request to an existing active trip instead of creating a new one.
- `enforce_trip_seat_capacity()` (the seat-cap trigger) already sums `seats_requested` only over `assigned`/`ongoing` rows per trip — a completed/cancelled passenger's seats are already correctly freed for a new accept.

None of the above needs to change.

## The actual gap

1. **UI**: nothing subscribes to the pending-requests board from `app/trip/active.tsx` — only Dashboard does, and Dashboard redirects away the instant a trip exists.
2. **Backend**: `complete_trip(p_trip_id, p_ride_request_id)` and `cancel_trip(p_trip_id, p_ride_request_id, p_reason)` each transition **both** the trip and the one named ride request together. There's no way today to close one passenger's leg while the trip and other passengers' still-active legs stay open.

## Decisions made during brainstorming

1. **Any-order completion** — a passenger can be completed/cancelled regardless of pickup order, matching real shared-tricycle riding and FR-9.2a's per-passenger-independent-closure wording.
2. **The trip stays open across zero-passenger gaps** — `trips.status='active'` means "driver is out working," not "currently carrying someone." The driver is not auto-returned to Dashboard when their last passenger completes; they stay on the active-trip screen, able to keep accepting new requests, until they explicitly end the trip.
3. **Rejected: client-side queue keeping only one passenger "current" on screen** — creates a real mismatch between backend state (multiple assigned) and UI capability (only one actionable), specifically defeating the any-order requirement.

## A. Database (one migration)

- `complete_ride_leg(p_trip_id, p_ride_request_id)` — same auth/ownership checks as today's `complete_trip`, but updates only the named `ride_requests` row (`status='completed'`, `completed_at`, `final_fare`). Trip untouched.
- `cancel_ride_leg(p_trip_id, p_ride_request_id, p_reason)` — same shape, mirrors today's `cancel_trip` minus the trip-status write.
- `end_trip(p_trip_id)` — new. Sets `trips.status='completed'`, `completed_at=now()`. Raises if any `ride_requests` on that trip are still `assigned`/`ongoing`.
- `get_active_trip_for_driver()` is narrowed to just the trip "header" (`trip_id`, `started_at`, 0-or-1 row) — its old 9-column shape is split off into a new `get_active_trip_passengers(p_trip_id)` (0–N rows, same passenger columns as before, ownership-checked internally). Splitting these was a correction made while writing the SQL, not in the original design: a single function returning "0 or 1 row, and the count of those rows also encodes the passenger list" can't represent "an active trip with nobody aboard right now" — that state would be indistinguishable from "no active trip at all," both being zero rows. Two focused calls avoids that ambiguity entirely rather than working around it with nullable-passenger sentinel rows.
- `complete_trip`/`cancel_trip` are dropped — confirmed via repo-wide grep that `packages/services/src/booking/index.ts` is their only caller anywhere in the codebase, so nothing else breaks.

## B. `packages/services/src/booking/index.ts`

- `completeTrip(tripId, rideRequestId)` → renamed `completeRideLeg`, calls `complete_ride_leg`.
- `cancelTrip(tripId, rideRequestId, reason)` → renamed `cancelRideLeg`, calls `cancel_ride_leg`.
- New `endTrip(tripId)`, calls `end_trip`.
- `getActiveTripForDriver()` now calls the trip-header RPC first; if a trip exists, calls `get_active_trip_passengers(tripId)` and returns `{ tripId, startedAt, passengers: ActiveTripPassenger[] }` (an empty array is valid — the driver's trip is active with nobody aboard right now). Two round trips instead of one, but this only ever runs once per app-session on boot/reconnect, so that cost is immaterial.

## C. `apps/driver` client

- `types/trip.ts`: `ActiveTrip` becomes `{ tripId: string; startedAt: string; passengers: ActivePassenger[] }`; new `ActivePassenger` carries what used to be `ActiveTrip`'s per-passenger scalar fields (`id` [=ride_request id], `passengerId`, `passengerName`, `passengerAvatarUrl`, `seats`, `paymentMethod`, `fare`, `cashConfirmed`).
- `store/useTripStore.ts`: `current: ActiveTrip | null` keeps its shape but its passenger data is now a list. `complete()`/`cancel()` become `completePassenger(rideRequestId)`/`cancelPassenger(rideRequestId, reason)`, removing that one passenger from the array. New `endTrip()` — succeeds only when `passengers.length === 0` (mirrors the DB's own check, so the button is disabled client-side too, not just server-rejected). `startTrip()` initializes `passengers` as a one-item array from the just-accepted request. `setPassengerInfo()` updates the matching passenger by `rideRequestId` instead of the single `current` object. `hydrate()` maps every row `getActiveTripForDriver()` returns into the `passengers` array.
- `hooks/useAcceptRideRequest.ts`: when a trip already exists, appending a newly-accepted passenger becomes a new store action (`addPassenger`) rather than always calling `startTrip()` (which now means "first passenger, new trip").
- `app/trip/active.tsx`: the single passenger card becomes a list of passenger cards, each with its own Complete/Cancel/cash-toggle (same `ConfirmModal` reason-required pattern as today's single Cancel). Below the list (or as the only content when it's empty), the same request-board mechanism `dashboard.tsx` already has — `useRequestsStore.subscribe()`/`RequestCard`/`useAcceptRideRequest()` — reused here, subscribed whenever this screen is mounted (i.e. whenever a trip is active) rather than gated on `isAvailable` the way Dashboard's is. A persistent "End trip" button, enabled only when the passenger list is empty, replaces the unconditional navigate-to-Dashboard `complete()`/`cancel()` used to do.
- `dashboard.tsx`'s existing `if (activeTrip) return <Redirect href="/trip/active" />` is unchanged — it already sends the driver here whenever a trip exists, empty or not.

## D. Testing

- `packages/services/tests/booking.test.ts`: rewritten/extended coverage for `completeRideLeg`/`cancelRideLeg`/`endTrip`, and `getActiveTripForDriver` returning 0/1/N rows.
- `apps/driver/tests/tripStore.test.js`: rewritten for the array shape — accept-while-trip-active appends, complete/cancel remove one passenger without touching the others, `endTrip()` rejects with passengers still present.
- Live verification against the real project, given this changes trip-completion semantics: a rolled-back SQL transaction (same discipline as F12's `fare_config` work) set up a real trip with 2 assigned ride requests, completed the *second*-accepted one first (proving any-order), confirmed the trip and the first passenger's leg both stayed untouched, confirmed `end_trip` is rejected with a passenger still active and succeeds once the list is empty, confirmed the trip header stays visible even with zero passengers (the "stay parked" case), and confirmed `cancel_ride_leg` rejects an already-completed leg — 12 checks, all passing, zero rows left behind. Caught and fixed one real bug this way: `end_trip`'s `RETURNS TABLE(trip_id uuid)` output parameter collided with the `ride_requests.trip_id` column reference inside the function body ("ambiguous column"). Separately confirmed all 5 functions are reachable via the real PostgREST REST API (not just raw SQL) with the exact argument names the client sends, and that `end_trip`'s rejection message matches what the client surfaces verbatim. **Not exercised through the actual app UI or a live device/session** — this is SQL-transaction-level and REST-layer verification plus unit tests, not a full click-through; worth a manual pass in the running app before treating this as proven in the field.

## Explicitly out of scope

- No passenger-app or admin-app changes — this is a driver-side data-model and DB-function change only.
- No change to the seat-capacity trigger, the matching Edge Function, or the accept RPC path — all three already behave correctly for this case.
