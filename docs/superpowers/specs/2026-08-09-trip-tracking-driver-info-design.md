# Trip tracking & real driver info — design

**Date:** 2026-08-09
**Scope:** `apps/passenger` (plus a new Postgres function + one `packages/services` addition). Corresponds to `docs/PASSENGER_TODO.MD` build-order item 5 / `docs/CHECKLIST.MD` P1 "Passenger: trip tracking after match."

## Problem

Three passenger screens still fake the post-match ride lifecycle with `wait(randomBetween(...))` timers instead of real backend state:

- `app/booking/finding-driver.tsx` — real (already subscribes to `ride_requests` status via `subscribeToRideRequestStatus`), but on match it never populates `useBookingStore`'s `driver` field. `setDriver` is defined but called nowhere in the app.
- `app/booking/driver-found.tsx` — fake timer (4–6s) advances to trip-in-progress regardless of any real trip state. Its "Cancel ride" button only resets local state; it never calls the cancellation service.
- `app/booking/trip-in-progress.tsx` — fake timer (5–8s) advances to payment regardless of whether `ride_requests.status` is actually `'completed'`. This is the documented reason `payment.tsx` isn't reachable through a real ride flow yet — the passenger arrives while the ride is still `'assigned'` and any payment attempt against it is meaningless.

## The pickup-signal gap

The schema has a `ride_requests.status` value `'ongoing'` ("trip started / passenger picked up") and a `picked_up_at` column, but nothing writes them — the driver-side mid-trip pickup screen (FR-2.5c) doesn't exist yet and is tracked as separate, larger driver-app work. So today `ride_requests.status` only moves `pending → assigned → completed | cancelled`; there is no real signal distinguishing "driver en route to you" from "you're riding."

**Decision:** merge `driver-found.tsx` and `trip-in-progress.tsx` into one screen (`app/booking/trip.tsx`) covering the whole `assigned` → `completed` span, rather than faking a distinction the backend doesn't have yet. This can be split apart later once the real pickup screen lands and starts writing `'ongoing'`/`picked_up_at`.

## The driver-info gap

Checked live RLS: a passenger cannot read `trips`, `driver_profiles`, `tricycles`, or another user's `users` row at all.

- `trips_driver_rw`: `driver_id = auth.uid() or is_pso()`
- `driver_select` (on `driver_profiles`): `user_id = auth.uid() or is_pso()`
- `tricycles_owner_rw`: `driver_id = auth.uid() or is_pso()`
- `users_select_self`: `id = auth.uid() or is_pso()`

None of these admit the passenger of an assigned ride. This was never wired because there was nothing to wire against.

**Fix:** a new `security definer` Postgres function, following the existing pattern used by `compute_fare`/`is_pso`/`notify_expiring_franchises`:

```sql
create or replace function public.get_trip_driver_info(p_ride_request_id uuid)
returns table (
  driver_id    uuid,
  driver_name  text,
  avatar_url   text,
  plate_no     text,
  rating_avg   numeric,
  rating_count int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
begin
  select trip_id into v_trip_id
  from public.ride_requests
  where id = p_ride_request_id
    and passenger_id = auth.uid();

  if v_trip_id is null then
    return;
  end if;

  return query
  select u.id, u.full_name, u.avatar_url, t.plate_no, dp.rating_avg, dp.rating_count
  from public.trips tr
  join public.users u on u.id = tr.driver_id
  join public.driver_profiles dp on dp.user_id = tr.driver_id
  left join public.tricycles t on t.id = tr.tricycle_id
  where tr.id = v_trip_id;
end $$;
```

- Authorization is enforced inside the function (`passenger_id = auth.uid()`), not by broadening any table's RLS — so no new surface for a passenger to see another passenger's driver, or a driver's private fields (license number, contact info) beyond what's selected here.
- Returns an empty result set (not an error) when the ride isn't found/owned/assigned yet — callers treat "no row" as "not available."
- No explicit `grant execute` needed — functions are callable by `authenticated` by default in this schema (same as `compute_fare`); `notify_expiring_franchises` is the only one that explicitly revokes, because it's cron-only.
- Applied live against project `ygdgbvxxqrkxlezpckif` via `apply_migration`, and `docs/SCHEMA.MD` updated to match (same workflow as the `passenger_discounts` front/back-photo migration earlier this session).

## Service layer

New function in `packages/services/src/booking/index.ts`, alongside `createRideRequest`/`cancelRideRequest`/`acceptRideRequest`/etc.:

```ts
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

export async function getTripDriverInfo(rideRequestId: string): Promise<GetTripDriverInfoResult>
```

Calls `.rpc('get_trip_driver_info', { p_ride_request_id: rideRequestId })`. Returns `{ data: null, error: null }` on an empty result set (not-yet-authorized/not-found is a normal state, not a failure) and `{ data: null, error: message }` on an actual RPC error.

`driverId` is included even though nothing currently consumes it, specifically so the future rate-driver step (`docs/PASSENGER_TODO.MD` item 7, `ratings.driver_id`) doesn't need a second round-trip — it reads it off the already-populated `useBookingStore().driver.id`.

## UI changes

**`app/booking/finding-driver.tsx`**
On `row.status === 'assigned'`, before navigating: call `getTripDriverInfo(rideRequestId)`.
- Success with data → `setDriver({ id: driverId, name: driverName ?? '', plateNumber: plateNo ?? '', rating: ratingAvg, etaMinutes: null })`, then navigate.
- Failure or no data → still navigate (the ride *is* assigned; don't strand the passenger over a display-only failure) with a minimal fallback (`{ id: rideRequestId, name: '', plateNumber: '', rating: null, etaMinutes: null }`) — `DriverInfoCard`'s existing empty-string/`null` handling already renders this as "Driver assigned" / "—" / no stars.

**New `app/booking/trip.tsx`** (replaces `driver-found.tsx` and `trip-in-progress.tsx`; both files and `trip-in-progress.styles.ts` are deleted)
- Keeps the settle-in slide animation and interactive `OsmMap` from `driver-found.tsx`; keeps the "On trip" `Badge` overlay from `trip-in-progress.tsx`.
- Renders the real `DriverInfoCard` (already exists, already handles nulls correctly — no changes needed there).
- Opens a second `subscribeToRideRequestStatus` channel (same helper `finding-driver.tsx` uses, new channel instance keyed by `rideRequestId`) to watch for:
  - `'completed'` → `setTripStatus('awaiting_payment')`, `router.replace('/booking/payment')`. This is also the fix for the known bug where passengers could reach "Pay now" before the ride request was genuinely `'completed'`.
  - `'cancelled'` → `reset()`, `router.replace('/(tabs)/home')` (driver-initiated cancellation via the driver app's existing `cancelTrip`).
- A Realtime drop surfaces the same inline error banner pattern `finding-driver.tsx` already uses.
- **"Cancel ride" button removed.** The current button on `driver-found.tsx` only resets local state — it was never wired to a real cancellation, and per RLS (`rr_passenger_cancel` requires `status = 'pending'`) it structurally can't be: once assigned, cancellation is driver/system-owned. Keeping a button that looks actionable but silently does nothing server-side is worse than removing it. The "No in-app call or message — coordination is in person" caption stays as the only text here.

## Testing

Add to `packages/services/tests/booking.test.ts`:
- `getTripDriverInfo` returns the mapped shape on a successful RPC call.
- `getTripDriverInfo` returns `{ data: null, error: message }` on an RPC error.
- `getTripDriverInfo` returns `{ data: null, error: null }` on an empty result set.

No local migration-testing harness exists in this repo (schema changes are applied live via MCP and captured in `docs/SCHEMA.MD`, same as every prior schema change this session) — the function will be verified live against project `ygdgbvxxqrkxlezpckif` after being applied, same workflow as the `passenger_discounts` front/back-photo migration.

## Out of scope (explicitly deferred)

- The real mid-trip pickup screen (FR-2.5c) and `'ongoing'`/`picked_up_at` writes — separate, larger driver-app task.
- Cash payment confirmation writing `transactions.status = 'paid'` — separate checklist item (`payment.tsx`'s cash path still uses a local `wait(800)`, untouched here).
- Live driver GPS / continuous position tracking — `etaMinutes` stays `null`; already noted as out of scope in `docs/DRIVER_TODO.MD`.
- Rate-driver real insert (`docs/PASSENGER_TODO.MD` item 7) — `driverId` is threaded through so that step doesn't need a second query, but the insert itself isn't built here.
