# Ride request insert, cancel, and realtime status — design spec

**Date:** 2026-08-02
**Scope:** `docs/PASSENGER_TODO.MD` backlog item 4 ("Ride request") only.
**Out of scope:** item 5 (`finding-driver.tsx`'s eventual real driver-match navigation payload, `driver-found.tsx`, `trip-in-progress.tsx`) — no driver-side code exists yet that assigns `ride_requests` to a `trip`, so this item cannot and does not simulate a match.

## Problem

`confirm.tsx`'s "Request ride" button currently only flips a local Zustand flag (`setTripStatus('searching')`) and pushes to `finding-driver.tsx`, which fakes a match after a random 2.5-4s delay via `pickRandomDriver()`. No row is ever written to `ride_requests`. This makes the passenger app's core action — requesting a ride — entirely client-side theater.

## Design

### Data flow

1. `confirm.tsx`: on "Request ride", insert a row into `public.ride_requests` (passenger-owned, `status` defaults to `'pending'`).
2. Store the returned row id in `useBookingStore` (`rideRequestId`).
3. Navigate to `finding-driver.tsx`, which subscribes to Postgres Changes on that one row via Supabase Realtime (the table is already in the `supabase_realtime` publication).
4. Cancelling (only possible while `status = 'pending'`, per the existing `rr_passenger_cancel` RLS policy) issues a real `UPDATE … SET status = 'cancelled'`.
5. Because no driver-side code exists yet, in practice a real request will sit at `'pending'` indefinitely in dev/testing unless manually flipped in the DB — this is expected and correct given the current backend state, not a bug to work around.

### `packages/services/src/booking/index.ts`

Replaces the current one-line stub. Follows the existing `{data, error}` convention used by `packages/services/src/{fare,discount}`.

```ts
export interface CreateRideRequestInput {
  passengerId: string;
  pickup: { latitude: number; longitude: number; label: string };
  dropoff: { latitude: number; longitude: number; label: string };
  seats: number;
  distanceKm: number;
  estimatedFare: number;
  preferredMethod: 'cash' | 'gcash';
  discountApplied: boolean;
  discountPercent: number | null;
}
export interface CreateRideRequestResult {
  data: RideRequestRow | null;
  error: string | null;
}
export async function createRideRequest(input: CreateRideRequestInput): Promise<CreateRideRequestResult>;

export interface CancelRideRequestResult {
  error: string | null;
}
export async function cancelRideRequest(rideRequestId: string, reason: string): Promise<CancelRideRequestResult>;
// UPDATE … SET status='cancelled', cancelled_at=now(), cancel_reason=reason WHERE id=rideRequestId
// RLS (rr_passenger_cancel) rejects this once status is no longer 'pending' — a 0-row result
// is surfaced as a plain error string ("Could not cancel — ride may already be assigned."),
// not treated as success.

export type RideRequestStatusUpdate = Pick<RideRequestRow, 'id' | 'status'>;
export function subscribeToRideRequestStatus(
  rideRequestId: string,
  onChange: (row: RideRequestStatusUpdate) => void,
): () => void; // returns unsubscribe
```

`RideRequestRow` = `Database['public']['Tables']['ride_requests']['Row']` from `database.types.ts` (already generated, no schema changes needed).

### `useBookingStore.ts`

Add `rideRequestId: string | null` + `setRideRequestId`, included in `reset()`.

### `confirm.tsx`

- `handleRequestRide` becomes `async`.
- "Request ride" button disabled condition extends from `!isGranted` to also cover `fare === null || fareError !== null` — submitting with no confirmed fare is meaningless data, not merely an inconvenience.
- On press: recompute `distanceKm` (already derived via `haversineDistanceKm` in the existing fare effect — same call, not cached), call `createRideRequest` with all the fields above, show a button-level loading state (`isRequesting`) during the call.
- On success: `setRideRequestId(data.id)`, `setTripStatus('searching')`, `router.push('/booking/finding-driver')`.
- On error: surface inline near the button (same visual pattern as `fareError`'s note), do not navigate.

### `finding-driver.tsx`

- Delete the `pickRandomDriver()` / `wait(randomBetween(2500, 4000))` block and its imports entirely.
- On mount: read `rideRequestId` from the store (if absent — e.g. deep-linked or stale state — redirect to `/(tabs)/home` immediately, mirroring `confirm.tsx`'s existing no-dropoff guard).
- Subscribe via `subscribeToRideRequestStatus`. On update:
  - `status === 'assigned'` → `setTripStatus('matched')`, `router.replace('/booking/driver-found')`. (`driver-found.tsx` still shows its existing "No driver matched" empty state since `driver` is never populated here — that population is item 5's job, untouched by this change.)
  - `status === 'cancelled'` (cancelled by another actor, e.g. a future PSO/admin path) → `reset()`, `router.replace('/(tabs)/home')`.
  - any other value → ignored.
- Unsubscribe on unmount.
- `handleCancel` becomes async: calls `cancelRideRequest(rideRequestId, 'Cancelled by passenger')`; on success `reset()` + navigate home as today; on error, surface it (e.g. a brief inline message) instead of silently resetting local state while the DB row is still live.
- Screen copy ("Finding a driver") is left as-is — it is now literally true, not aspirational.

### Cleanup

- `apps/passenger/src/mocks/drivers.ts` — its only caller is the deleted block; delete the file.
- `apps/passenger/DESIGN.md:132` references `pickRandomDriver()` as part of the "flows still run end to end" walkability claim — update that line to reflect that ride-matching now genuinely waits on the backend and is no longer simulated.

### Explicitly out of scope

- `driver-found.tsx`'s own cancel button and fake `wait()` match-to-in-progress timer, and `trip-in-progress.tsx`'s fake timers — all explicitly item 5 (`docs/PASSENGER_TODO.MD` row 5), which needs real `trips`/`driver_profiles` subscriptions this item does not build.
- `pickup_barangay_id` resolution — already deferred in item 2/3's notes; still meaningless without PostGIS.
- Any timeout/expiry UX for a `ride_requests` row stuck at `pending` forever (e.g. "no drivers available, try again") — there is no backend signal to distinguish "still searching" from "no driver will ever come" until item 5 exists. Not building speculative UX for a state the backend can't yet produce.

## Testing

- Unit-level: none of the existing test infra (`apps/passenger/tests/sample.test.js`) covers Supabase-backed flows yet; no new test scaffolding is being added for this item specifically (matches the existing pattern — `createRideRequest`/`cancelRideRequest` are thin RPC/query wrappers like `estimateFare`, which also has no unit test).
- Manual verification against the live `ygdgbvxxqrkxlezpckif` project: insert a real row via the app, confirm it appears in `ride_requests` with correct fields; cancel from `finding-driver.tsx` and confirm `status` flips to `'cancelled'`; manually flip a test row's `status` to `'assigned'` via SQL and confirm the app navigates to `driver-found.tsx` in real time.
