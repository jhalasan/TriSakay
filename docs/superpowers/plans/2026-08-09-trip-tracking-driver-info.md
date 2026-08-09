# Trip Tracking & Real Driver Info Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fake `wait()` timers in the passenger app's post-match ride flow with real backend state: populate the matched driver's real name/plate/rating, merge `driver-found.tsx` + `trip-in-progress.tsx` into one screen driven by real `ride_requests` status changes, and only let the passenger reach payment once the ride is genuinely `'completed'`.

**Architecture:** A new `security definer` Postgres function `get_trip_driver_info(p_ride_request_id uuid)` is the only way a passenger can read their matched driver's info — RLS on `trips`/`driver_profiles`/`tricycles`/other users' `users` rows blocks direct reads entirely today. `finding-driver.tsx` calls it once `ride_requests.status` flips to `'assigned'` and populates `useBookingStore().driver`. A new single screen `app/booking/trip.tsx` (replacing both `driver-found.tsx` and `trip-in-progress.tsx`, since there's no real backend signal yet distinguishing "driver en route" from "on trip" — see the design doc) subscribes to the same `ride_requests` row for `'completed'`/`'cancelled'` and navigates accordingly.

**Tech Stack:** Expo SDK 54 / React Native 0.81, TypeScript, Supabase (Postgres + Realtime + PostgREST RPC), `node:test` runner (Node 24, native TS type-stripping), Supabase MCP tools for live schema changes (no local migration files in this repo).

**Design doc:** `docs/superpowers/specs/2026-08-09-trip-tracking-driver-info-design.md`

## Global Constraints

- No new npm dependencies.
- `get_trip_driver_info` must be `security definer`, `stable`, `set search_path = public`, and self-authorize via `passenger_id = auth.uid()` inside the function body — do not fix the read gap by broadening RLS on `trips`/`driver_profiles`/`tricycles`/`users` instead (that would leak more than the passenger needs, e.g. license numbers, contact info).
- The function returns an **empty result set**, never a raised exception, when the ride isn't found/owned/assigned — callers key off `data === null`, not a caught error.
- `etaMinutes` on the passenger app's `Driver` type stays `null` — live driver position tracking is out of scope (unchanged from today).
- `driver-found.tsx`, `trip-in-progress.tsx`, and their style files are **deleted**, replaced by one `app/booking/trip.tsx` (+ `trip.styles.ts`) — do not keep both routes side by side.
- The "Cancel ride" control on the post-assignment screen is **removed**, not disabled — RLS (`rr_passenger_cancel`) only allows passenger cancellation while `status = 'pending'`, so a client-only cancel button here is dead UI, not a working feature.
- This repo has no local migration files or DB test harness — schema changes are applied live via the Supabase MCP tools against project `ygdgbvxxqrkxlezpckif` and captured in `docs/SCHEMA.MD`, exactly like every other schema change so far this session.

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `docs/SCHEMA.MD` | Add `get_trip_driver_info` function definition (§4.3c) | **Modify** |
| `packages/services/src/supabase/database.types.ts` | Regenerated types including the new RPC function | **Modify** |
| `packages/services/tests/fakeSupabaseClient.ts` | Add `.rpc()` override support | **Modify** |
| `packages/services/src/booking/index.ts` | Add `getTripDriverInfo()` + `TripDriverInfo` type | **Modify** |
| `packages/services/tests/booking.test.ts` | Tests for `getTripDriverInfo()` | **Modify** |
| `apps/passenger/app/booking/finding-driver.tsx` | Fetch driver info on match, before navigating | **Modify** |
| `apps/passenger/app/booking/trip.tsx` | New merged "matched → completed" screen | **Create** |
| `apps/passenger/src/styles/booking/trip.styles.ts` | Styles for the merged screen | **Create** |
| `apps/passenger/app/booking/driver-found.tsx` | Superseded by `trip.tsx` | **Delete** |
| `apps/passenger/app/booking/trip-in-progress.tsx` | Superseded by `trip.tsx` | **Delete** |
| `apps/passenger/src/styles/booking/driver-found.styles.ts` | Superseded by `trip.styles.ts` | **Delete** |
| `apps/passenger/src/styles/booking/trip-in-progress.styles.ts` | Superseded by `trip.styles.ts` | **Delete** |
| `apps/passenger/DESIGN.md` | Fix a stale reference to the deleted `trip-in-progress` screen | **Modify** |

**Task order:** Task 1 (DB function, self-contained) → Task 2 (service layer, consumes Task 1's types) → Task 3 (UI, consumes Task 2's `getTripDriverInfo`).

---

### Task 1: `get_trip_driver_info` Postgres function

**Files:**
- Modify: `docs/SCHEMA.MD`
- Modify: `packages/services/src/supabase/database.types.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a live RPC `get_trip_driver_info(p_ride_request_id uuid)` callable via `supabase.rpc('get_trip_driver_info', { p_ride_request_id })`, returning zero or one row of `{ driver_id, driver_name, avatar_url, plate_no, rating_avg, rating_count }`.

> No `node:test` here — this is a live database object, not app code. Verification is live SQL against the Supabase project, the same workflow used for every prior schema change this session (see `docs/SCHEMA.MD`'s own history and this session's `passenger_discounts` front/back-photo migration).

- [ ] **Step 1: Apply the migration**

Call the Supabase `apply_migration` tool against project `ygdgbvxxqrkxlezpckif`:

```
name: get_trip_driver_info_function
```
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

comment on function public.get_trip_driver_info is
  'Security-definer read of a passenger''s matched driver''s public info (name/avatar/plate/rating). Passengers have no direct SELECT on trips/driver_profiles/tricycles/other users'' users rows, so this is the only path — authorization is enforced inside the function body via passenger_id = auth.uid(), not by broadening those tables'' RLS. Returns an empty result set (not an exception) when the ride is not found, not owned by the caller, or not yet assigned.';
```

- [ ] **Step 2: Verify the function exists with the right security mode**

Call the Supabase `execute_sql` tool:

```sql
select proname, prosecdef, provolatile
from pg_proc
where proname = 'get_trip_driver_info';
```

Expected: one row, `prosecdef = true` (security definer), `provolatile = 's'` (stable).

- [ ] **Step 3: Verify authorization behavior live, with throwaway data rolled back**

Call `execute_sql` with this single script (wrapped in `begin`/`rollback` so nothing is left behind — no manual cleanup needed):

```sql
begin;

insert into public.users (id, email, full_name, role) values
  ('11111111-1111-1111-1111-111111111111', 'temp-passenger@test.local', 'Temp Passenger', 'passenger'),
  ('22222222-2222-2222-2222-222222222222', 'temp-other@test.local', 'Temp Other Passenger', 'passenger'),
  ('33333333-3333-3333-3333-333333333333', 'temp-driver@test.local', 'Temp Driver', 'driver');

insert into public.driver_profiles (user_id, rating_avg, rating_count) values
  ('33333333-3333-3333-3333-333333333333', 4.75, 20);

insert into public.tricycles (id, driver_id, plate_no, is_active, verification_status) values
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'TEMP-001', true, 'approved');

insert into public.trips (id, driver_id, tricycle_id, status) values
  ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', 'active');

insert into public.ride_requests (id, passenger_id, pickup_lat, pickup_lng, dest_lat, dest_lng, trip_id, status) values
  ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 6.11, 125.17, 6.12, 125.18, '55555555-5555-5555-5555-555555555555', 'assigned');

set local role authenticated;

set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select * from public.get_trip_driver_info('66666666-6666-6666-6666-666666666666');

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select * from public.get_trip_driver_info('66666666-6666-6666-6666-666666666666');

rollback;
```

Expected: the first `select` returns exactly one row (`driver_name = 'Temp Driver'`, `plate_no = 'TEMP-001'`, `rating_avg = 4.75`, `rating_count = 20`); the second `select` (a different passenger asking about the same ride) returns zero rows. The `rollback` at the end means the temp rows never persist — if the tool reports each statement's result separately, confirm both `select` results before trusting the rollback happened; if it only reports the final state, a follow-up `select count(*) from public.users where email like 'temp-%@test.local';` should return `0`.

- [ ] **Step 4: Update `docs/SCHEMA.MD` to match**

In `docs/SCHEMA.MD`, insert the function immediately before the `-- 4.4 seat capacity enforcement` section header (currently right after `is_cluster_authorized`'s `comment on function` line):

```sql

-- 4.3c trip driver info (passenger-visible) -----------------------------
-- Passengers have no direct SELECT on trips/driver_profiles/tricycles/other
-- users' users rows (see §7.1-7.4) — this security-definer function is the
-- only path to a matched driver's public info, self-authorized via
-- passenger_id = auth.uid() rather than broadening those tables' RLS.
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

Use exactly the same SQL as Step 1 (this file is documentation of what's live, not a second source of truth).

- [ ] **Step 5: Regenerate TypeScript types**

Call the Supabase `generate_typescript_types` tool against project `ygdgbvxxqrkxlezpckif`. Overwrite `packages/services/src/supabase/database.types.ts` with the full returned output (same procedure used earlier this session for the `passenger_discounts` front/back-photo migration — the file's `Functions` block should now include a `get_trip_driver_info` entry with `Args: { p_ride_request_id: string }` and a `Returns` array of the six-field row shape).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --build packages/services/tsconfig.json --force` (from repo root)
Expected: no errors. This forces the referenced-project declaration output to pick up the regenerated types, matching the workaround needed for the discount-photo migration earlier this session.

- [ ] **Step 7: Commit**

```bash
git add docs/SCHEMA.MD packages/services/src/supabase/database.types.ts
git commit -m "feat(db): add get_trip_driver_info RPC for passenger-visible driver info"
```

---

### Task 2: Service layer — `getTripDriverInfo`

**Files:**
- Modify: `packages/services/tests/fakeSupabaseClient.ts`
- Modify: `packages/services/src/booking/index.ts`
- Modify: `packages/services/tests/booking.test.ts`

**Interfaces:**
- Consumes: the `get_trip_driver_info` RPC from Task 1 (via `database.types.ts`'s regenerated `Functions` block).
- Produces:
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
  export function getTripDriverInfo(rideRequestId: string): Promise<GetTripDriverInfoResult>;
  ```

- [ ] **Step 1: Add `.rpc()` override support to the fake Supabase client**

In `packages/services/tests/fakeSupabaseClient.ts`, add to the `FakeClientConfig` interface (after `functionsInvoke`):

```ts
  /** Override for `.rpc(fn, args)` — used by RPC-based service functions (e.g. get_trip_driver_info). */
  rpc?: (fn: string, args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
```

In the object returned at the bottom of `createFakeSupabaseClient` (the one with `auth`, `from`, `functions`, `channel`, `removeChannel`), add:

```ts
    rpc: config.rpc ?? (() => { throw new Error('rpc not configured on fake client'); }),
```

- [ ] **Step 2: Write the failing tests**

Add to `packages/services/tests/booking.test.ts` (the file already imports `test`, `assert`, `__setSupabaseClientForTests`, `createFakeSupabaseClient`; add `getTripDriverInfo` to the existing named import from `'../src/booking/index.ts'`):

```ts
test('getTripDriverInfo maps the RPC row into TripDriverInfo', async () => {
  let capturedFn: string | null = null;
  let capturedArgs: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn, args) => {
        capturedFn = fn;
        capturedArgs = args;
        return {
          data: [{
            driver_id: 'driver1',
            driver_name: 'Juan Dela Cruz',
            avatar_url: 'https://example.com/a.jpg',
            plate_no: 'ABC-123',
            rating_avg: 4.8,
            rating_count: 12,
          }],
          error: null,
        };
      },
    })
  );

  const { data, error } = await getTripDriverInfo('rr1');

  assert.equal(error, null);
  assert.equal(capturedFn, 'get_trip_driver_info');
  assert.deepEqual(capturedArgs, { p_ride_request_id: 'rr1' });
  assert.deepEqual(data, {
    driverId: 'driver1',
    driverName: 'Juan Dela Cruz',
    avatarUrl: 'https://example.com/a.jpg',
    plateNo: 'ABC-123',
    ratingAvg: 4.8,
    ratingCount: 12,
  });
});

test('getTripDriverInfo surfaces an RPC error', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async () => ({ data: null, error: { message: 'network error' } }),
    })
  );

  const { data, error } = await getTripDriverInfo('rr1');
  assert.equal(data, null);
  assert.equal(error, 'network error');
});

test('getTripDriverInfo returns null data with no error on an empty result set', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async () => ({ data: [], error: null }),
    })
  );

  const { data, error } = await getTripDriverInfo('rr1');
  assert.equal(data, null);
  assert.equal(error, null);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd packages/services && node --test tests/booking.test.ts`
Expected: FAIL — `getTripDriverInfo` is not exported from `../src/booking/index.ts` yet.

- [ ] **Step 4: Implement `getTripDriverInfo`**

In `packages/services/src/booking/index.ts`, add near the bottom of the file (after `cancelTrip`):

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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd packages/services && node --test tests/booking.test.ts`
Expected: PASS — all `booking.test.ts` tests pass, including the 3 new ones.

- [ ] **Step 6: Run the full services test suite and typecheck**

Run: `cd packages/services && npm run test` then `npx tsc --build packages/services/tsconfig.json --force` (from repo root)
Expected: PASS, no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/services/tests/fakeSupabaseClient.ts packages/services/src/booking/index.ts packages/services/tests/booking.test.ts
git commit -m "feat(services): add getTripDriverInfo, reads the get_trip_driver_info RPC"
```

---

### Task 3: Passenger UI — real driver info + merged trip screen

**Files:**
- Modify: `apps/passenger/app/booking/finding-driver.tsx`
- Create: `apps/passenger/src/styles/booking/trip.styles.ts`
- Create: `apps/passenger/app/booking/trip.tsx`
- Delete: `apps/passenger/app/booking/driver-found.tsx`
- Delete: `apps/passenger/app/booking/trip-in-progress.tsx`
- Delete: `apps/passenger/src/styles/booking/driver-found.styles.ts`
- Delete: `apps/passenger/src/styles/booking/trip-in-progress.styles.ts`
- Modify: `apps/passenger/DESIGN.md`

**Interfaces:**
- Consumes: `getTripDriverInfo` from Task 2 (`@trisakay/services`); existing `subscribeToRideRequestStatus` (`@trisakay/services`); existing `useBookingStore` (`setDriver`, `setTripStatus`, `reset`, `driver`, `pickup`, `rideRequestId`); existing `DriverInfoCard` (`apps/passenger/src/components/DriverInfoCard`).
- Produces: no new exports — this is the integration point. Route `/booking/trip` replaces `/booking/driver-found` and `/booking/trip-in-progress`.

> No `node:test` unit tests here — these are React Native screens with no RN test runner in this repo (same as the confirm-screen wiring in the route/fare-estimate plan). Verification is `npm run typecheck`/`tsc --build` plus the manual smoke checklist in the final step. The logic these screens call (`getTripDriverInfo`, `subscribeToRideRequestStatus`) is already covered by Task 2's and the existing booking tests.

- [ ] **Step 1: Wire real driver info into `finding-driver.tsx`**

In `apps/passenger/app/booking/finding-driver.tsx`:

Change the import line:
```ts
import { cancelRideRequest, subscribeToRideRequestStatus } from '@trisakay/services';
```
to:
```ts
import { cancelRideRequest, getTripDriverInfo, subscribeToRideRequestStatus } from '@trisakay/services';
```

Add a `setDriver` selector next to the existing `setTripStatus` one:
```ts
  const setTripStatus = useBookingStore((state) => state.setTripStatus);
  const setDriver = useBookingStore((state) => state.setDriver);
  const reset = useBookingStore((state) => state.reset);
```

Replace the `'assigned'` branch inside the `subscribeToRideRequestStatus` callback:
```ts
        if (row.status === 'assigned') {
          hasExitedRef.current = true;
          setTripStatus('matched');
          router.replace('/booking/driver-found');
        } else if (row.status === 'cancelled') {
```
with:
```ts
        if (row.status === 'assigned') {
          hasExitedRef.current = true;
          getTripDriverInfo(row.id).then(({ data }) => {
            if (cancelled) return;
            setDriver({
              id: data?.driverId ?? row.id,
              name: data?.driverName ?? '',
              plateNumber: data?.plateNo ?? '',
              rating: data?.ratingAvg ?? null,
              etaMinutes: null,
            });
            setTripStatus('matched');
            router.replace('/booking/trip');
          });
        } else if (row.status === 'cancelled') {
```

(The fallback `data?.driverId ?? row.id` / empty strings mean a failed or empty RPC result still lets the passenger through — `DriverInfoCard` already renders empty `name`/`plateNumber` as "Driver assigned" / "—" and hides stars when `rating` is `null`.)

- [ ] **Step 2: Create `trip.styles.ts`**

Create `apps/passenger/src/styles/booking/trip.styles.ts`:

```ts
import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapFill: {
    ...StyleSheet.absoluteFillObject,
  },
  statusBadgeWrap: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.lg,
  },
  /** Floats over the bottom of the full-bleed map instead of sitting below it in normal flow — paddingBottom is finished off at the call site with the safe-area inset. */
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.panel,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    ...elevation.sheet,
  },
  /** A brand-gradient handle bar rather than a plain grey one — the same small threading device carried through finding-driver → trip. */
  sheetAccent: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  caption: {
    ...typography.caption,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
});
```

- [ ] **Step 3: Create the merged `trip.tsx` screen**

Create `apps/passenger/app/booking/trip.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Animated, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { subscribeToRideRequestStatus } from '@trisakay/services';
import { Badge, Button, EmptyState, GradientSurface, OsmMap, motion, spacing } from '@trisakay/ui';
import { DriverInfoCard } from '../../src/components/DriverInfoCard';
import { useBookingStore } from '../../src/store/useBookingStore';
import { styles } from '../../src/styles/booking/trip.styles';

export default function TripScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const driver = useBookingStore((state) => state.driver);
  const pickup = useBookingStore((state) => state.pickup);
  const rideRequestId = useBookingStore((state) => state.rideRequestId);
  const setTripStatus = useBookingStore((state) => state.setTripStatus);
  const reset = useBookingStore((state) => state.reset);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  // Same exit-guard pattern as finding-driver.tsx: reset() clears
  // rideRequestId, which would otherwise re-fire this effect a second time
  // before the component finishes unmounting from the first navigate-away.
  const hasExitedRef = useRef(false);

  /** Same settle-in entrance used when this screen previously arrived from finding-driver. */
  const settle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(settle, {
      toValue: 1,
      duration: motion.duration.settle,
      easing: motion.easing.out,
      useNativeDriver: true,
    }).start();
  }, [settle]);

  useEffect(() => {
    if (hasExitedRef.current) return;

    if (!rideRequestId) {
      hasExitedRef.current = true;
      reset();
      router.replace('/(tabs)/home');
      return;
    }

    let cancelled = false;

    const unsubscribe = subscribeToRideRequestStatus(
      rideRequestId,
      (row) => {
        if (cancelled) return;
        if (row.status === 'completed') {
          hasExitedRef.current = true;
          setTripStatus('awaiting_payment');
          router.replace('/booking/payment');
        } else if (row.status === 'cancelled') {
          hasExitedRef.current = true;
          reset();
          router.replace('/(tabs)/home');
        }
      },
      (message) => {
        if (!cancelled) setSubscriptionError(message);
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideRequestId]);

  if (!driver) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyWrap}>
          <EmptyState title="No driver matched" message="Try requesting a ride again." />
          <Button label="Back to Home" onPress={() => router.replace('/(tabs)/home')} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapFill}>
        <OsmMap
          variant="route"
          caption="Map · trip route"
          height="100%"
          latitude={pickup?.latitude}
          longitude={pickup?.longitude}
          zoom={15}
          interactive
          edgeToEdge
        />
      </View>

      <View style={styles.statusBadgeWrap}>
        <Badge label="Driver assigned" tone="blue" dot />
      </View>

      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: spacing.xl + insets.bottom },
          {
            opacity: settle,
            transform: [
              { translateY: settle.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
            ],
          },
        ]}
      >
        <GradientSurface token="brand" direction="diagonal" style={styles.sheetAccent} />
        <DriverInfoCard driver={driver} />
        {subscriptionError && <Text style={styles.error}>{subscriptionError}</Text>}
        <Text style={styles.caption}>No in-app call or message — coordination is in person.</Text>
      </Animated.View>
    </View>
  );
}
```

- [ ] **Step 4: Delete the superseded screens and styles**

```bash
git rm apps/passenger/app/booking/driver-found.tsx apps/passenger/app/booking/trip-in-progress.tsx apps/passenger/src/styles/booking/driver-found.styles.ts apps/passenger/src/styles/booking/trip-in-progress.styles.ts
```

- [ ] **Step 5: Fix the stale `trip-in-progress` reference in `DESIGN.md`**

In `apps/passenger/DESIGN.md`, under "Map & OSM compliance", change:
```markdown
- **Attribution** — "© OpenStreetMap contributors" renders via Leaflet's own attribution control at 12px in `colors.inkSoft`. On `trip-in-progress` it moves bottom-left (`attributionLeft`) *and* is lifted by `bottomInset`, because `driverStrip` spans the bottom of the screen — moving it sideways alone still left it clipped.
```
to:
```markdown
- **Attribution** — "© OpenStreetMap contributors" renders via Leaflet's own attribution control at 12px in `colors.inkSoft`.
```
(The `trip-in-progress`/`driverStrip`/`attributionLeft` combination this described no longer exists — `trip.tsx` uses the same plain floating sheet `driver-found.tsx` used, not a bottom-spanning strip.)

- [ ] **Step 6: Typecheck**

Run: `npx tsc --build packages/services/tsconfig.json apps/passenger/tsconfig.json --force` (from repo root)
Expected: no errors — in particular, no remaining references to `/booking/driver-found` or `/booking/trip-in-progress` anywhere (expo-router's typed routes would otherwise fail to resolve them).

- [ ] **Step 7: Manual smoke test**

Run: `npm run start:passenger`

Manual checklist (needs a seeded verified driver + tricycle, matching the checklist's existing "not yet exercised live" note for the match-ride-request function — if no such test account exists yet, this step is deferred, not skipped silently):
- Request a ride and have a driver (test account) accept it → the app leaves `finding-driver` and lands on `trip.tsx` showing the real driver's name, plate, and rating (not "Driver assigned"/"—" placeholders, unless the driver profile genuinely has no rating yet).
- The "On trip"/cancel button from the old `driver-found.tsx` is gone — only the "No in-app call or message" caption remains.
- Complete the trip from the driver app (`apps/driver`'s `active.tsx` → "Complete trip") → the passenger app automatically navigates to `/booking/payment` (no manual timer wait).
- Cancel the trip from the driver app instead → the passenger app returns to `(tabs)/home`.
- Kill the Realtime connection (e.g. airplane mode) while on `trip.tsx` → the inline error banner appears instead of a silent hang.

- [ ] **Step 8: Commit**

```bash
git add apps/passenger/app/booking/finding-driver.tsx apps/passenger/app/booking/trip.tsx apps/passenger/src/styles/booking/trip.styles.ts apps/passenger/DESIGN.md
git commit -m "feat(passenger): real driver info + merge driver-found/trip-in-progress into trip.tsx"
```

---

## Self-Review

**Spec coverage:**
- New `security definer` RPC, authorized via `passenger_id = auth.uid()`, empty-result (not exception) on not-found → Task 1. ✅
- Service wrapper `getTripDriverInfo` mapping the RPC row → Task 2. ✅
- `driverId` included for the future rate-driver step, without a second query → Task 2 (`TripDriverInfo.driverId`) + Task 3 (threaded into `useBookingStore().driver.id`). ✅
- `finding-driver.tsx` populates real driver info before navigating, with a graceful fallback on failure → Task 3 Step 1. ✅
- Screens merged into `trip.tsx`, `driver-found.tsx`/`trip-in-progress.tsx` deleted → Task 3 Steps 2-4. ✅
- Real subscription for `'completed'`/`'cancelled'` replacing the `wait()` timers, fixing the "reaches payment before really completed" bug → Task 3 Step 3. ✅
- "Cancel ride" button removed (RLS can't support it post-assignment) → Task 3 Step 3 (button omitted entirely from the new screen). ✅
- `etaMinutes` stays `null` → Task 3 Step 1 (`etaMinutes: null` in the `setDriver` call). ✅
- Live verification against the actual Supabase project, no local migration harness → Task 1 Steps 2-3. ✅
- Out-of-scope items (mid-trip pickup screen, cash payment confirmation, live GPS, rate-driver insert) are explicitly not touched by any task. ✅

**Placeholder scan:** No TBD/TODO/"handle edge cases" — every step has concrete SQL/TypeScript/commands. ✅

**Type consistency:** `TripDriverInfo` fields (`driverId`, `driverName`, `avatarUrl`, `plateNo`, `ratingAvg`, `ratingCount`) are identical across Task 2's interface, its tests' `assert.deepEqual` shapes, and Task 3's `data?.driverId`/`data?.driverName`/etc. accesses. `getTripDriverInfo` name and signature (`(rideRequestId: string) => Promise<GetTripDriverInfoResult>`) match between Task 2's implementation and Task 3's import/call. The RPC name string `'get_trip_driver_info'` is identical in Task 1's SQL, Task 2's `.rpc()` call, and Task 2's test assertion on `capturedFn`. ✅
