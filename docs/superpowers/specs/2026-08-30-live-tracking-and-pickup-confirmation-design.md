# Live Driver Tracking + Pickup Confirmation — Design

**Scope:** `apps/driver`, `apps/passenger`, `packages/services`, `packages/shared` (i18n), plus DB migrations (RLS policy + one new RPC).

Cross-reference: `docs/CONTEXT.MD` FR-2.9, FR-2.10, NFR-2.5; `docs/RIDE_REQUEST_FLOW_AUDIT.MD` gaps #1, #2, #3, #4 (photo drop).

Addresses three of the audit's highest-priority findings:
1. Driver location is captured once at go-online and never updates again.
2. Passenger's trip screen shows no live driver marker/route/ETA.
3. The `ongoing` `ride_status` value is dead — no "confirm pickup / start ride" step exists distinct from accept/complete.

Also fixes, in the same code path as #2, a bug already caught during the audit: `finding-driver.tsx` hardcodes `etaMinutes: null` and drops the driver's `avatarUrl`, so the ETA badge can never render and the passenger only ever sees initials, never the driver's photo (FR-2.9).

## Decisions locked during brainstorming

1. **Foreground-only location tracking.** No background-location permission/task on either OS. Tracking runs only while the driver's app is in the foreground, consistent with NFR-2.5's "no background/idle tracking" framing and avoiding the added native-permission surface a capstone doesn't need to defend.
2. **Straight-line ETA/route, no routing engine.** Matches the existing `match-ride-request` heuristic's own lightweight-trigonometry approach (haversine + bearing, no OSRM call). ETA = `haversineKm(driver, pickup) / ASSUMED_SPEED_KMH * 60`, documented as an approximation, not real drive time.
3. **Per-passenger "Start" action**, not trip-level. Matches the existing per-passenger Complete/Cancel/cash-confirm pattern on `trip/active.tsx` and correctly handles mid-trip pickups (FR-2.5c), where different passengers on the same trip are picked up at different times.
4. **Live tracking visible only while `status = 'assigned'`**, not `'ongoing'`. Once picked up, the passenger is physically with the driver — nothing left to track — and RLS access revoking itself the moment the leg leaves `'assigned'` gives NFR-2.5's "auto-off on completion" for free, with no extra app logic.

## A. Database

### A.1 New RLS policy — scoped driver-location visibility for the matched passenger

`driver_profiles` currently has no SELECT policy passengers can ever satisfy (`driver_select` only allows `user_id = auth.uid() or is_pso()`), so a plain Realtime subscription today reaches zero rows for a passenger. Add one more permissive SELECT policy (Postgres RLS policies of the same command are OR'd):

```sql
create policy driver_select_matched_passenger on public.driver_profiles
  for select using (
    exists (
      select 1 from public.ride_requests rr
      join public.trips t on t.id = rr.trip_id
      where t.driver_id = driver_profiles.user_id
        and rr.passenger_id = auth.uid()
        and rr.status = 'assigned'
    )
  );
```

This is what makes a plain `postgres_changes` subscription on `driver_profiles` (already in the `supabase_realtime` publication) deliver location updates to exactly the one passenger currently matched and not yet picked up — no new channel, no broadcast mechanism, no persisted trail beyond the already-existing transient `current_lat/current_lng` columns.

**Verify against the live project before writing this migration**: confirm the exact current text of `driver_select` (columns/verbs) and whether Realtime's Postgres Changes authorization on this project version indeed re-evaluates RLS per subscribing user (expected behavior on current Supabase, but confirm rather than assume, since this policy is the only thing making step B.2 work).

### A.2 New RPC — `start_ride_leg(p_trip_id uuid, p_ride_request_id uuid)`

Mirrors `complete_ride_leg`/`cancel_ride_leg`'s existing shape (same migration family as the mid-trip-pickup design, `docs/superpowers/specs/2026-08-21-mid-trip-pickup-design.md`):
- Same ownership check as those two (caller must be the trip's driver).
- Requires the named `ride_requests` row's current status is `'assigned'` (raises a friendly error otherwise — mirrors how `complete_ride_leg` already guards its own preconditions).
- Sets `status = 'ongoing'`, `picked_up_at = now()`.
- Trip and other passengers on it are untouched, same as its two siblings.

**Before writing this migration**: pull the actual live definitions of `complete_ride_leg` and `cancel_ride_leg` from the project (they postdate `docs/SCHEMA.MD`, which is a living/lagging snapshot per `docs/RIDE_REQUEST_FLOW_AUDIT.MD` — only 2 loose `.sql` files exist under `supabase/migrations` locally, so the authoritative source is the live database, not the repo). Match their exact error-message style and ownership-check SQL rather than reinventing it.

### A.3 `complete_ride_leg` precondition tightening

Add a status guard so a leg can only be completed from `'ongoing'` (currently, per the mid-trip-pickup design, it's only ever reachable from `'assigned'`). Confirm the live function's current precondition before editing it — this may already be a bare "must belong to caller's trip" check with no status guard at all, in which case this is a net-new guard, not a change to an existing one.

## B. `packages/services`

### B.1 `src/booking/index.ts`

- New `startRideLeg(tripId: string, rideRequestId: string): Promise<{ error: string | null }>` — calls the new RPC, same shape/error-handling style as `completeRideLeg`/`cancelRideLeg` immediately above it in the file.

### B.2 `src/location/index.ts`

- New `subscribeToDriverLocation(driverId: string, onUpdate: (loc: { lat: number; lng: number; updatedAt: string } | null) => void): () => void` — opens a `postgres_changes` (UPDATE) subscription on `driver_profiles` filtered `user_id=eq.<driverId>`, mapping `current_lat/current_lng/location_updated_at` to the callback (null lat/lng, e.g. after the driver goes offline, calls back with `null`). Returns an unsubscribe function, same convention as `subscribeToRideRequestStatus`.
- `updateDriverAvailability()` is unchanged; a new throttled writer function `pushDriverLocation(coords: Coordinates)` is added alongside it for the watch-position hook to call repeatedly — a thin `.update({ current_lat, current_lng, location_updated_at })` scoped to the signed-in driver, factored out so the availability-toggle path and the continuous-watch path share one write helper instead of duplicating the update shape.

### B.3 `packages/shared` — ETA constant

- Add `ASSUMED_TRICYCLE_SPEED_KMH = 20` (or wherever existing shared constants for fare/matching live, e.g. alongside `haversineKm`/`bearingDeg` if those are already in `packages/shared` — confirm their actual location before adding a duplicate implementation) and a small `estimateEtaMinutes(distanceKm: number): number` helper so both the driver-distance display and any future reuse compute ETA the same way.

## C. `apps/driver`

### C.1 `src/hooks/useDriverLocationSync.ts` (new)

- Mounted in `app/_layout.tsx` alongside the existing `useRequestsSync`, mirroring its lifecycle pattern (subscription/watch owned session-wide, gated on `isAvailable`).
- While `isAvailable === true` and the app is in the foreground (`AppState === 'active'`): runs `Location.watchPositionAsync({ accuracy: Balanced, distanceInterval: 30, timeInterval: 8000 }, cb)`, calling `pushDriverLocation()` on each fix.
- Stops the watch when `isAvailable` flips false, or when `AppState` leaves `'active'`; restarts on return to foreground if still available. No watch is ever started while offline.

### C.2 `app/trip/active.tsx`

- Each passenger card: while `passenger.status === 'assigned'`, show a **Start** button (new copy key `t.driver.tripActive.start`) calling `startPassenger(passenger.id)` (new `useTripStore` action wrapping `startRideLeg`, same optimistic-update-then-reconcile style as `completePassenger`/`cancelPassenger`).
- `canComplete` gains `passenger.status === 'ongoing'` to its existing condition (`(!isCash || passenger.cashConfirmed) && !isCompleting`), so Complete is unreachable before Start.
- `ActivePassenger` type (`apps/driver/src/types/trip.ts`) gains a `status: 'assigned' | 'ongoing'` field, populated by `get_active_trip_passengers()` — confirm that RPC already returns `ride_requests.status` today; if not, it needs to start doing so as part of this change.

### C.3 `useTripStore.ts`

- New `startPassenger(rideRequestId: string): Promise<boolean>` action, structurally parallel to `completePassenger`/`cancelPassenger`: calls `startRideLeg`, updates that one passenger's `status` in the array on success, surfaces `tripError` on failure.

## D. `apps/passenger`

### D.1 `finding-driver.tsx`

- Stop discarding `avatarUrl` from `getTripDriverInfo()` — pass it through to `setDriver()`. `Driver` type (`apps/passenger/src/types/driver.ts`) gains `avatarUrl: string | null`.
- Stop hardcoding `etaMinutes: null` — compute it from the driver's `current_lat/current_lng` (already present on the `getTripDriverInfo()` row) vs. the ride's pickup point, via the new `estimateEtaMinutes()` helper. If the driver has no location yet (e.g. stale/never-set), fall back to `null` (existing behavior) rather than a bogus 0.

### D.2 `booking/trip.tsx`

- While `ride.status === 'assigned'`: subscribe via `subscribeToDriverLocation(driverId, ...)` (started on mount, torn down on unmount/status change away from `'assigned'`). Render the driver's live marker on the existing `OsmMap` and a straight polyline from driver → pickup point. Recompute the ETA badge (via `estimateEtaMinutes()`) on every location update.
- While `ride.status === 'ongoing'`: unsubscribe (RLS will also stop delivering rows at this point regardless — belt and suspenders), swap the map/ETA UI for a simpler "trip in progress" state — no live tracking needed since the passenger is aboard.
- `DriverInfoCard` needs no changes — it already renders `avatarUrl`/`etaMinutes` when non-null; both are just newly wired to real values from C.1/D.1.

## E. i18n

- `packages/shared/src/i18n/en.ts` and `fil.ts`: add `driver.tripActive.start` ("Start ride" / Filipino equivalent), and any passenger-side copy needed for the "trip in progress, no tracking" state if `trip.tsx` doesn't already have suitable copy for that state.

## F. Testing

- `packages/services/tests/booking.test.ts`: coverage for `startRideLeg` (happy path, wrong-status rejection, wrong-owner rejection) — same shape as existing `completeRideLeg`/`cancelRideLeg` tests.
- `packages/services/tests/location.test.ts` (new or extended): `subscribeToDriverLocation` subscribes/unsubscribes correctly, maps null coords to a `null` callback.
- `apps/driver/tests/tripStore.test.js`: `startPassenger` updates the one passenger's status without touching others; `canComplete`-equivalent logic (if tested at the store level) rejects completion before start.
- Live verification against the real project (same discipline as the mid-trip-pickup design's rolled-back-transaction approach): confirm `start_ride_leg` and the tightened `complete_ride_leg` guard both behave correctly via raw SQL/REST before touching the UI; confirm the new RLS policy actually gates/ungates `driver_profiles` visibility for a non-owning passenger user at each ride status (`pending` → no access before assignment, `assigned` → access, `ongoing`/`completed`/`cancelled` → no access) using two real Supabase Auth sessions, not just as the service role.
- Manual click-through on a real device/simulator pair (driver + passenger) is called out explicitly as still needed before calling this done — Realtime + RLS interaction and `watchPositionAsync` behavior are exactly the kind of thing unit tests won't catch.

## Explicitly out of scope

- No expanding-radius matching change, no request-board multi-select UX, no trip-summary screen — those are separate, lower-priority audit findings (#5, #6, #7 in `docs/RIDE_REQUEST_FLOW_AUDIT.MD`) and are not touched here.
- No background-location tracking on either OS.
- No real road-routing polyline or drive-time ETA — straight-line only, by design (see Decision 2).
- No change to the matching Edge Function itself — freshening `current_lat/current_lng` via A.1/C.1 makes its existing reads more accurate, but its logic is untouched.
