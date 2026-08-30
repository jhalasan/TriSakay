# Live Driver Tracking + Pickup Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three audit-flagged gaps in TRISAKAY's ride flow: (1) driver GPS is captured once at go-online and never refreshed, (2) the passenger's trip screen shows no live driver marker/route/ETA, (3) the `ongoing` ride status is dead — there is no "confirm pickup / start ride" step distinct from accept/complete. Also fixes two bugs caught in the same code path: the passenger app drops the driver's photo, and hardcodes `etaMinutes: null`.

**Architecture:** A driver-side `watchPositionAsync` hook keeps `driver_profiles.current_lat/current_lng` fresh while online (foreground-only). A new RLS policy scopes `driver_profiles` SELECT to the one passenger currently matched via an `assigned` ride request, so a plain Realtime subscription — no new channel type — delivers live location only to that passenger, only for that window. The passenger's trip screen computes a straight-line ETA client-side (no routing engine) and renders the driver's position on the existing Leaflet map via a small, non-remounting bridge function (extending the existing `injectJavaScript` pattern already used for the recenter button). A new `start_ride_leg` RPC, mirroring the existing `complete_ride_leg`/`cancel_ride_leg` pair, lets a driver mark one passenger's leg `ongoing` before completing it.

**Tech Stack:** Supabase (Postgres, RLS, Realtime, RPC via `SECURITY DEFINER` functions), Expo/React Native (`expo-location`), Zustand, Leaflet (via a WebView bridge in `packages/ui`), `node --test` for all TS/JS unit tests.

**Spec:** `docs/superpowers/specs/2026-08-30-live-tracking-and-pickup-confirmation-design.md`

## Global Constraints

- Foreground-only location tracking — no background-location permission or task on either OS (spec Decision 1).
- ETA/route is a straight-line haversine estimate against an assumed speed constant — no routing-engine call anywhere in this feature (spec Decision 2).
- "Start ride" is a per-passenger action, mirroring the existing per-passenger Complete/Cancel/cash-confirm pattern on `trip/active.tsx` (spec Decision 3).
- Live driver-location visibility to a passenger exists only while that passenger's own `ride_requests.status = 'assigned'` — enforced by RLS, not app logic (spec Decision 4).
- Every new/changed SQL function must be applied to the live Supabase project (`ygdgbvxxqrkxlezpckif`) via `mcp__claude_ai_Supabase__apply_migration`, mirrored into a local file under `supabase/migrations/`, matching the project's existing pattern where the live DB — not the partially-stale `docs/SCHEMA.MD` — is the source of truth.
- Match existing code style exactly: `SECURITY DEFINER`, `SET search_path TO 'public'`, `RETURNS TABLE(...)` for RPCs; Zustand stores follow the `set`/`get` closure style already in `useTripStore.ts`; service functions return `{ data, error }` or `{ error }` shapes, never throw.

---

### Task 1: Database — RLS policy, `start_ride_leg` RPC, tightened `complete_ride_leg`, `status` on `get_active_trip_passengers`

**Files:**
- Create: `supabase/migrations/20260830120000_live_tracking_and_pickup_confirmation.sql`
- Apply via `mcp__claude_ai_Supabase__apply_migration` (project_id `ygdgbvxxqrkxlezpckif`) — this project's authoritative schema lives in the deployed database, confirmed by reading the live `complete_ride_leg`/`cancel_ride_leg`/`get_active_trip_passengers` definitions directly (they postdate `docs/SCHEMA.MD`).

**Interfaces:**
- Produces: RLS policy `driver_select_matched_passenger` on `driver_profiles`; RPC `start_ride_leg(p_trip_id uuid, p_ride_request_id uuid) returns table(ride_request_id uuid)`; `get_active_trip_passengers(p_trip_id uuid)` now returns an additional `status ride_status` column as its last column; `complete_ride_leg` now only succeeds from `status = 'ongoing'` (previously `'assigned'` or `'ongoing'`).

This task has no automated test file of its own — SQL correctness is verified by direct queries against the live project (steps below), and by Task 4's unit tests exercising the RPCs through the fake Supabase client (those tests assert the *shape* of the call, not live DB behavior).

- [ ] **Step 1: Confirm current live definitions one more time (guards against drift between spec-writing and now)**

Run via `mcp__claude_ai_Supabase__execute_sql` (project_id `ygdgbvxxqrkxlezpckif`):

```sql
select proname, pg_get_functiondef(p.oid) as def
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname in ('complete_ride_leg', 'get_active_trip_passengers');
```

Expected: `complete_ride_leg`'s `where` clause still reads `status in ('assigned', 'ongoing')`, and `get_active_trip_passengers`'s `returns table(...)` list still ends at `cash_confirmed boolean)` with no `status` column. If either has changed since this plan was written, stop and reconcile before proceeding — the SQL below assumes exactly these two shapes.

- [ ] **Step 2: Write the migration file**

```sql
-- 20260830120000_live_tracking_and_pickup_confirmation.sql
-- Live driver tracking + pickup confirmation (docs/superpowers/specs/2026-08-30-live-tracking-and-pickup-confirmation-design.md)

-- A. Scoped SELECT so a passenger's Realtime subscription on driver_profiles
-- delivers rows only for the driver currently matched to them, and only
-- while that leg is 'assigned' (not yet picked up, not completed/cancelled).
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

-- B. New RPC: marks one passenger's leg picked up. Same ownership-check shape
-- as complete_ride_leg/cancel_ride_leg.
create or replace function public.start_ride_leg(p_trip_id uuid, p_ride_request_id uuid)
 returns table(ride_request_id uuid)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_now timestamptz := now();
begin
  if not exists (
    select 1 from public.trips
    where id = p_trip_id and driver_id = auth.uid() and status = 'active'
  ) then
    raise exception 'No active trip found for this driver to start';
  end if;

  update public.ride_requests
  set status = 'ongoing', picked_up_at = v_now
  where id = p_ride_request_id
    and trip_id = p_trip_id
    and status = 'assigned';

  if not found then
    raise exception 'Ride request not found for this trip';
  end if;

  return query select p_ride_request_id;
end;
$function$;

-- C. Tighten complete_ride_leg: a leg must be started (picked up) before it
-- can be completed. Previously allowed straight from 'assigned'.
create or replace function public.complete_ride_leg(p_trip_id uuid, p_ride_request_id uuid)
 returns table(ride_request_id uuid)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_now timestamptz := now();
  v_estimated_fare numeric;
begin
  if not exists (
    select 1 from public.trips
    where id = p_trip_id and driver_id = auth.uid() and status = 'active'
  ) then
    raise exception 'No active trip found for this driver to complete';
  end if;

  select estimated_fare into v_estimated_fare
  from public.ride_requests
  where id = p_ride_request_id
    and trip_id = p_trip_id;

  perform set_config('trisakay.allow_fare_write', 'on', true);

  update public.ride_requests
  set status = 'completed', completed_at = v_now, final_fare = coalesce(v_estimated_fare, final_fare)
  where id = p_ride_request_id
    and trip_id = p_trip_id
    and status = 'ongoing';

  if not found then
    raise exception 'Ride request not found for this trip';
  end if;

  return query select p_ride_request_id;
end;
$function$;

-- D. get_active_trip_passengers now also returns each leg's status, so the
-- driver UI can tell 'assigned' (needs Start) apart from 'ongoing' (needs
-- Complete) after an app restart / trip rehydrate.
create or replace function public.get_active_trip_passengers(p_trip_id uuid)
 returns table(ride_request_id uuid, seats_requested smallint, preferred_method payment_method, estimated_fare numeric, passenger_id uuid, passenger_name text, avatar_url text, cash_confirmed boolean, status ride_status)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not exists (
    select 1 from public.trips where id = p_trip_id and driver_id = auth.uid()
  ) then
    return;
  end if;

  return query
  select
    rr.id,
    rr.seats_requested,
    rr.preferred_method,
    rr.estimated_fare,
    u.id,
    u.full_name,
    u.avatar_url,
    coalesce(txn.status = 'paid', false),
    rr.status
  from public.ride_requests rr
  join public.users u on u.id = rr.passenger_id
  left join public.transactions txn on txn.ride_request_id = rr.id
  where rr.trip_id = p_trip_id
    and rr.status in ('assigned', 'ongoing')
  order by rr.assigned_at asc nulls last;
end;
$function$;
```

- [ ] **Step 3: Apply the migration to the live project**

Call `mcp__claude_ai_Supabase__apply_migration` with `project_id: 'ygdgbvxxqrkxlezpckif'`, a `name` of `live_tracking_and_pickup_confirmation`, and the SQL from Step 2 as the query.

- [ ] **Step 4: Verify the RLS policy actually gates access — as two real users, not the service role**

Run via `execute_sql` (service role bypasses RLS, so this must simulate two authenticated users using `set local role authenticated; set local request.jwt.claims = ...` or, simpler, by checking `pg_policies` plus a logic walkthrough since a full two-session RLS test requires real JWTs):

```sql
select policyname, cmd, qual from pg_policies where tablename = 'driver_profiles' order by policyname;
```

Expected: `driver_select_matched_passenger` appears alongside the existing `driver_select`, with `qual` matching the `exists(...)` clause from Step 2. Confirm by inspection that `rr.status = 'assigned'` (not `in ('assigned','ongoing')`) — the policy must NOT admit `'ongoing'`, per spec Decision 4.

- [ ] **Step 5: Verify `start_ride_leg` and the tightened `complete_ride_leg` behave correctly via a rolled-back transaction**

Run via `execute_sql`, wrapped so nothing is left behind (same discipline as the mid-trip-pickup design's own verification):

```sql
begin;
-- pick any existing driver_id/trip_id/ride_request_id in 'assigned' status for a live sanity check, e.g.:
select id, trip_id, status from public.ride_requests where status = 'assigned' limit 1;
-- (inspect the result, then continue using that row's ids)
-- as that driver (requires impersonation — simplest is to call the functions directly if testing as postgres/service role bypasses ownership checks, so instead just confirm the SQL parses and the guarded UPDATE ... WHERE status = 'ongoing' clause is present via \sf or pg_get_functiondef)
select pg_get_functiondef('public.complete_ride_leg(uuid,uuid)'::regprocedure);
select pg_get_functiondef('public.start_ride_leg(uuid,uuid)'::regprocedure);
rollback;
```

Expected: both function bodies match Step 2 exactly (confirms `apply_migration` landed). A full driver-authenticated call-through (actually invoking `start_ride_leg` then `complete_ride_leg` as a real driver session) is deferred to Task 12's manual device pass, since simulating `auth.uid()` for a specific driver from the SQL editor requires a real JWT, not just SQL.

- [ ] **Step 6: Commit is deferred**

Do not `git add`/`git commit` this migration file yet — hold all commits for this feature until the whole plan's tasks are done and the user has said whether to commit (this repo's local `main` auto-pushes to `origin/main`, so committing here would immediately push to origin).

---

### Task 2: `packages/shared` — straight-line ETA helper

**Files:**
- Create: `packages/shared/src/utils/geo.ts`
- Modify: `packages/shared/src/utils/index.ts`
- Modify: `packages/shared/src/constants/index.ts`
- Test: `packages/shared/tests/geo.test.ts`

**Interfaces:**
- Produces: `ASSUMED_TRICYCLE_SPEED_KMH: number` (from `constants/index.ts`); `haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number` and `estimateEtaMinutes(distanceKm: number): number` (from `utils/geo.ts`, re-exported via `utils/index.ts`).
- Consumes: nothing from other tasks.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/shared/tests/geo.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm, estimateEtaMinutes } from '../src/utils/geo.ts';

test('haversineKm returns ~0 for identical points', () => {
  assert.ok(haversineKm(6.1164, 125.1717, 6.1164, 125.1717) < 0.001);
});

test('haversineKm returns a sane distance for two known General Santos points', () => {
  // Roughly 1.1km apart (City Hall area to a nearby point), tolerant band.
  const km = haversineKm(6.1164, 125.1717, 6.1258, 125.1706);
  assert.ok(km > 0.9 && km < 1.3, `expected ~1.0-1.1km, got ${km}`);
});

test('estimateEtaMinutes divides distance by the assumed speed and converts to minutes', () => {
  // 5km at 20km/h = 0.25h = 15 minutes.
  assert.equal(estimateEtaMinutes(5), 15);
});

test('estimateEtaMinutes rounds to the nearest whole minute', () => {
  // 1km at 20km/h = 0.05h = 3 minutes exactly; 1.2km = 3.6 min -> rounds to 4.
  assert.equal(estimateEtaMinutes(1.2), 4);
});

test('estimateEtaMinutes returns 0 for zero distance', () => {
  assert.equal(estimateEtaMinutes(0), 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && node --test ./tests/geo.test.ts`
Expected: FAIL — `Cannot find module '../src/utils/geo.ts'`.

- [ ] **Step 3: Write the implementation**

```typescript
// packages/shared/src/utils/geo.ts
const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two lat/lng points, in kilometres. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Straight-line ETA estimate — deliberately not a routing-engine call (see
 * docs/superpowers/specs/2026-08-30-live-tracking-and-pickup-confirmation-design.md
 * Decision 2). Consistent with the matching heuristic's own haversine-only approach.
 */
export function estimateEtaMinutes(distanceKm: number, speedKmh: number): number {
  if (distanceKm <= 0) return 0;
  return Math.round((distanceKm / speedKmh) * 60);
}
```

Note: `estimateEtaMinutes` takes `speedKmh` as an explicit second parameter (not a hidden default) so the test in Step 1 must pass it. Update Step 1's test calls to `estimateEtaMinutes(5, 20)` / `estimateEtaMinutes(1.2, 20)` / `estimateEtaMinutes(0, 20)` before running — explicit is better here than a hidden default, since a caller forgetting the constant should be a type error, not a silent wrong answer.

- [ ] **Step 4: Add the speed constant**

```typescript
// packages/shared/src/constants/index.ts — add to the existing file
export const APP_NAMES = {
  passenger: 'TriSakay Passenger',
  driver: 'TriSakay Driver',
  admin: 'TriSakay Admin',
} as const;

/** Assumed average tricycle speed for straight-line ETA estimates (km/h). Not measured — a documented approximation. */
export const ASSUMED_TRICYCLE_SPEED_KMH = 20;
```

- [ ] **Step 5: Re-export from utils barrel**

```typescript
// packages/shared/src/utils/index.ts — add this line
export * from './geo.ts';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd packages/shared && node --test ./tests/geo.test.ts`
Expected: PASS (5 tests) — after updating the two `estimateEtaMinutes` calls in Step 1 to pass `20` as the second argument.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/utils/geo.ts packages/shared/src/utils/index.ts packages/shared/src/constants/index.ts packages/shared/tests/geo.test.ts
git commit -m "feat(shared): add haversine distance and straight-line ETA helpers"
```

(Per Task 1 Step 6's note, hold this commit — and every commit below — until the user confirms whether to commit at all, given local `main` auto-pushes to `origin/main`.)

---

### Task 3: `packages/services` — continuous location push + passenger-side subscription

**Files:**
- Modify: `packages/services/src/location/index.ts`
- Test: `packages/services/tests/location.test.ts`

**Interfaces:**
- Consumes: `getSupabaseClient()` from `../supabase/client.ts` (existing).
- Produces: `pushDriverLocation(coords: Coordinates): Promise<{ error: string | null }>`; `subscribeToDriverLocation(driverId: string, onUpdate: (loc: { lat: number; lng: number; updatedAt: string } | null) => void): () => void`.

- [ ] **Step 1: Write the failing tests**

```typescript
// Append to packages/services/tests/location.test.ts

import { pushDriverLocation, subscribeToDriverLocation } from '../src/location/index.ts';

test('pushDriverLocation writes only lat/lng/location_updated_at for the signed-in driver', async () => {
  let captured: any = null;
  let capturedEqArgs: [string, unknown] | null = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: (table) =>
        table === 'driver_profiles'
          ? {
              update: (patch: unknown) => {
                captured = patch;
                return {
                  eq: async (column: string, value: unknown) => {
                    capturedEqArgs = [column, value];
                    return { error: null };
                  },
                };
              },
            }
          : {},
    })
  );

  const { error } = await pushDriverLocation({ lat: 6.12, lng: 125.18 });
  assert.equal(error, null);
  assert.equal(captured.current_lat, 6.12);
  assert.equal(captured.current_lng, 125.18);
  assert.equal(typeof captured.location_updated_at, 'string');
  assert.deepEqual(capturedEqArgs, ['user_id', 'u1']);
});

test('pushDriverLocation returns an error when there is no active session', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ getSession: async () => ({ data: { session: null } }) })
  );
  const { error } = await pushDriverLocation({ lat: 0, lng: 0 });
  assert.equal(error, 'Not signed in');
});

interface FakeLocationChannel {
  on: (event: string, filter: unknown, handler: (payload: { new: Record<string, unknown> }) => void) => FakeLocationChannel;
  subscribe: () => FakeLocationChannel;
}

test('subscribeToDriverLocation filters on the given driver id and maps coordinates', async () => {
  let capturedFilter: any = null;
  let capturedHandler: ((payload: { new: Record<string, unknown> }) => void) | null = null;
  const fakeChannel: FakeLocationChannel = {
    on: (_event, filter, handler) => {
      capturedFilter = filter;
      capturedHandler = handler;
      return fakeChannel;
    },
    subscribe: () => fakeChannel,
  };
  let removedChannel: unknown = null;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      channel: (name: string) => {
        assert.equal(name, 'driver_location_d1');
        return fakeChannel;
      },
      removeChannel: (channel: unknown) => {
        removedChannel = channel;
      },
    })
  );

  const received: unknown[] = [];
  const unsubscribe = subscribeToDriverLocation('d1', (loc) => received.push(loc));

  assert.equal(capturedFilter.filter, 'user_id=eq.d1');
  assert.equal(capturedFilter.event, 'UPDATE');
  assert.equal(capturedFilter.table, 'driver_profiles');
  assert.ok(capturedHandler);

  capturedHandler!({ new: { current_lat: 6.1, current_lng: 125.1, location_updated_at: '2026-08-30T00:00:00Z' } });
  assert.deepEqual(received, [{ lat: 6.1, lng: 125.1, updatedAt: '2026-08-30T00:00:00Z' }]);

  unsubscribe();
  assert.equal(removedChannel, fakeChannel);
});

test('subscribeToDriverLocation maps a null-coordinate row (driver went offline) to a null callback', async () => {
  let capturedHandler: ((payload: { new: Record<string, unknown> }) => void) | null = null;
  const fakeChannel: FakeLocationChannel = {
    on: (_event, _filter, handler) => {
      capturedHandler = handler;
      return fakeChannel;
    },
    subscribe: () => fakeChannel,
  };

  __setSupabaseClientForTests(
    createFakeSupabaseClient({ channel: () => fakeChannel, removeChannel: () => {} })
  );

  const received: unknown[] = [];
  subscribeToDriverLocation('d1', (loc) => received.push(loc));
  capturedHandler!({ new: { current_lat: null, current_lng: null, location_updated_at: null } });
  assert.deepEqual(received, [null]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/services && node --test ./tests/location.test.ts`
Expected: FAIL — `pushDriverLocation`/`subscribeToDriverLocation` are not exported yet.

- [ ] **Step 3: Implement**

```typescript
// packages/services/src/location/index.ts — add below the existing exports

/**
 * Throttled writer for the continuous-watch path (apps/driver's
 * useDriverLocationSync). Unlike updateDriverAvailability, this never touches
 * is_available — it's called repeatedly while already online.
 */
export async function pushDriverLocation(coords: Coordinates): Promise<{ error: string | null }> {
  const userId = await getSignedInUserId();
  if (!userId) return { error: 'Not signed in' };

  const { error } = await getSupabaseClient()
    .from('driver_profiles')
    .update({
      current_lat: coords.lat,
      current_lng: coords.lng,
      location_updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) return { error: toFriendlyMessage(error.message) };
  return { error: null };
}

export interface DriverLocation {
  lat: number;
  lng: number;
  updatedAt: string;
}

/**
 * Live driver location for the ONE passenger currently matched to this
 * driver via an 'assigned' ride request — RLS policy
 * `driver_select_matched_passenger` is what actually restricts this to that
 * passenger; this function has no scoping logic of its own. Delivers `null`
 * when the row's coordinates are null (driver went offline — the
 * `clear_location_when_offline` trigger nulls them server-side).
 */
export function subscribeToDriverLocation(
  driverId: string,
  onUpdate: (loc: DriverLocation | null) => void
): () => void {
  const client = getSupabaseClient();
  const channel = client
    .channel(`driver_location_${driverId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'driver_profiles', filter: `user_id=eq.${driverId}` },
      (payload: { new: { current_lat: number | null; current_lng: number | null; location_updated_at: string | null } }) => {
        const row = payload.new;
        if (row.current_lat === null || row.current_lng === null || row.location_updated_at === null) {
          onUpdate(null);
          return;
        }
        onUpdate({ lat: row.current_lat, lng: row.current_lng, updatedAt: row.location_updated_at });
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/services && node --test ./tests/location.test.ts`
Expected: PASS (all tests in the file, existing + new).

- [ ] **Step 5: Commit**

```bash
git add packages/services/src/location/index.ts packages/services/tests/location.test.ts
git commit -m "feat(services): add continuous driver-location push and passenger-side subscription"
```

---

### Task 4: `packages/services` — `startRideLeg` and `status` on `getActiveTripForDriver`

**Files:**
- Modify: `packages/services/src/booking/index.ts`
- Test: `packages/services/tests/booking.test.ts`

**Interfaces:**
- Consumes: `start_ride_leg` RPC (Task 1); `status` column now returned by `get_active_trip_passengers` (Task 1).
- Produces: `startRideLeg(tripId: string, rideRequestId: string): Promise<{ error: string | null }>`; `ActiveTripPassenger.status: 'assigned' | 'ongoing'` (new field, populated in `getActiveTripForDriver`'s mapping).

- [ ] **Step 1: Write the failing tests**

```typescript
// Append to packages/services/tests/booking.test.ts, near the completeRideLeg/cancelRideLeg tests
import { startRideLeg } from '../src/booking/index.ts'; // add to the existing top-of-file import list instead if preferred

test('startRideLeg calls the start_ride_leg RPC with the trip id and ride request id', async () => {
  let capturedFn: string | null = null;
  let capturedArgs: any = null;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn, args) => {
        capturedFn = fn;
        capturedArgs = args;
        return { data: [{ ride_request_id: 'rr1' }], error: null };
      },
    })
  );

  const { error } = await startRideLeg('trip1', 'rr1');

  assert.equal(error, null);
  assert.equal(capturedFn, 'start_ride_leg');
  assert.deepEqual(capturedArgs, { p_trip_id: 'trip1', p_ride_request_id: 'rr1' });
});

test('startRideLeg surfaces a friendly error when the RPC fails', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async () => ({ data: null, error: { message: 'Ride request not found for this trip' } }),
    })
  );

  const { error } = await startRideLeg('trip1', 'rr1');
  assert.equal(error, "Couldn't start this passenger's ride. Please try again.");
});

test('getActiveTripForDriver maps each passenger row\'s status field', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn) => {
        if (fn === 'get_active_trip_for_driver') {
          return { data: [{ trip_id: 't1', started_at: '2026-08-30T00:00:00Z' }], error: null };
        }
        if (fn === 'get_active_trip_passengers') {
          return {
            data: [
              {
                ride_request_id: 'rr1',
                seats_requested: 1,
                preferred_method: 'cash',
                estimated_fare: 20,
                passenger_id: 'p1',
                passenger_name: 'Ana',
                avatar_url: null,
                cash_confirmed: false,
                status: 'ongoing',
              },
            ],
            error: null,
          };
        }
        throw new Error(`unexpected rpc ${fn}`);
      },
    })
  );

  const { data, error } = await getActiveTripForDriver();
  assert.equal(error, null);
  assert.equal(data?.passengers[0]?.status, 'ongoing');
});
```

(`getActiveTripForDriver` is already imported at the top of `booking.test.ts` per the existing import list — only `startRideLeg` needs adding to that import.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/services && node --test ./tests/booking.test.ts`
Expected: FAIL — `startRideLeg` is not exported, and the status-mapping test fails because `ActiveTripPassenger` has no `status` field yet.

- [ ] **Step 3: Implement**

```typescript
// packages/services/src/booking/index.ts

// 1. Add `status` to the ActiveTripPassenger interface (near line 435):
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

// 2. In getActiveTripForDriver's passengerRows.map(...) (near line 488), add:
//    status: row.status,
// as the last mapped field.

// 3. New function, placed next to completeRideLeg/cancelRideLeg:
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
```

Also check `packages/services/src/supabase/database.types.ts` for a generated `get_active_trip_passengers` return-row type — if it's a hand-maintained or generated file listing RPC return shapes, add the new `status: Database['public']['Enums']['ride_status']` field there too so the `row.status` reference in Step 3.2 type-checks. If it's fully auto-generated from the live schema, regenerate it via `mcp__claude_ai_Supabase__generate_typescript_types` (project_id `ygdgbvxxqrkxlezpckif`) instead of hand-editing it, and diff the result before overwriting the file.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/services && node --test ./tests/booking.test.ts`
Expected: PASS (all tests in the file, existing + new).

- [ ] **Step 5: Commit**

```bash
git add packages/services/src/booking/index.ts packages/services/tests/booking.test.ts packages/services/src/supabase/database.types.ts
git commit -m "feat(services): add startRideLeg RPC wrapper and surface ride status on active-trip passengers"
```

---

### Task 5: `apps/driver` — `useTripStore.startPassenger`, `ActivePassenger.status`, per-passenger Start gating

**Files:**
- Modify: `apps/driver/src/types/trip.ts`
- Modify: `apps/driver/src/store/useTripStore.ts`
- Test: `apps/driver/tests/tripStore.test.js`

**Interfaces:**
- Consumes: `startRideLeg` (Task 4); `ActiveTripPassenger.status` (Task 4, via `getActiveTripForDriver`).
- Produces: `ActivePassenger.status: 'assigned' | 'ongoing'`; `useTripStore.startPassenger(rideRequestId: string): Promise<boolean>`.

- [ ] **Step 1: Write the failing tests**

Read the existing `apps/driver/tests/tripStore.test.js` first to match its exact mocking style (it likely mocks `@trisakay/services/src/booking/index.ts`'s `completeRideLeg`/`cancelRideLeg` the same way `booking.test.ts` mocks the Supabase client — follow whatever pattern is already there). Add:

```javascript
// Append to apps/driver/tests/tripStore.test.js, following the file's existing mock-setup pattern for completePassenger/cancelPassenger

test('startPassenger marks the named passenger ongoing on success, leaves others untouched', async () => {
  // Arrange: seed the store with two 'assigned' passengers via startTrip/addPassenger,
  // mock startRideLeg to resolve { error: null } for rr1.
  // Act: await useTripStore.getState().startPassenger('rr1')
  // Assert: passengers.find(p => p.id === 'rr1').status === 'ongoing'
  //         passengers.find(p => p.id === 'rr2').status === 'assigned' (untouched)
  //         the function returned true
});

test('startPassenger surfaces the error and leaves status unchanged on failure', async () => {
  // Mock startRideLeg to resolve { error: 'boom' }.
  // Assert: useTripStore.getState().error === 'boom', status still 'assigned', returns false.
});

test('passengerFromRequest defaults a freshly accepted passenger to status "assigned"', () => {
  // Exercise via startTrip(request, tripId) and assert passengers[0].status === 'assigned'.
});
```

Write these three tests with real assertions (not comments) matching the exact mock-injection mechanism the existing file already uses for `completePassenger` — read that file's top-of-file setup before writing these, since this plan doesn't have its literal mocking helper in view.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/driver && node --test ./tests/tripStore.test.js`
Expected: FAIL — `startPassenger` doesn't exist; `status` is `undefined` on passenger objects.

- [ ] **Step 3: Implement**

```typescript
// apps/driver/src/types/trip.ts
import type { PaymentMethod } from './request';

export interface ActivePassenger {
  id: string;
  passengerId: string | null;
  passengerName: string | null;
  passengerAvatarUrl: string | null;
  seats: number;
  paymentMethod: PaymentMethod;
  fare: number | null;
  cashConfirmed: boolean;
  /** 'assigned' (needs Start) or 'ongoing' (picked up, needs Complete). */
  status: 'assigned' | 'ongoing';
}

export interface ActiveTrip {
  tripId: string;
  startedAt: string;
  passengers: ActivePassenger[];
}
```

```typescript
// apps/driver/src/store/useTripStore.ts

// 1. Import startRideLeg alongside the existing booking imports:
import {
  cancelRideLeg,
  completeRideLeg,
  startRideLeg,
  endTrip as endTripRpc,
  getActiveTripForDriver,
} from '@trisakay/services/src/booking/index.ts';

// 2. passengerFromRequest gains status: 'assigned' (a freshly accepted request is always 'assigned' server-side):
function passengerFromRequest(request: PendingRequest): ActivePassenger {
  return {
    id: request.id,
    passengerId: null,
    passengerName: null,
    passengerAvatarUrl: null,
    seats: request.seats,
    paymentMethod: request.paymentMethod,
    fare: request.fare,
    cashConfirmed: false,
    status: 'assigned',
  };
}

// 3. Add to the TripState interface:
  /** Marks one passenger's leg picked up (assigned -> ongoing); Complete is unreachable before this succeeds. */
  startPassenger: (rideRequestId: string) => Promise<boolean>;

// 4. Add the action, structurally parallel to completePassenger:
    startPassenger: async (rideRequestId) => {
      const trip = get().current;
      const passenger = trip?.passengers.find((p) => p.id === rideRequestId);
      if (!trip || !passenger || passenger.status !== 'assigned') return false;
      const fallbackMessage = getTranslations().driver.errors.startPassengerFailed;

      try {
        const { error } = await withTimeout(startRideLeg(trip.tripId, rideRequestId), REQUEST_TIMEOUT_MS, fallbackMessage);
        if (error) {
          set({ error });
          return false;
        }

        set((state) =>
          state.current
            ? {
                current: {
                  ...state.current,
                  passengers: state.current.passengers.map((p) => (p.id === rideRequestId ? { ...p, status: 'ongoing' } : p)),
                },
                error: null,
              }
            : state
        );
        return true;
      } catch {
        set({ error: fallbackMessage });
        return false;
      }
    },

// 5. hydrate()'s passenger mapping gains `status: p.status` alongside the other mapped fields.
```

Add `startPassengerFailed: "Couldn't start this passenger's ride. Please try again."` to `driver.errors` in both `packages/shared/src/i18n/en.ts` and `fil.ts` (English text shown; add the Filipino equivalent following that file's existing phrasing style for the sibling `completePassengerFailed`/`cancelPassengerFailed` keys).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/driver && node --test ./tests/tripStore.test.js`
Expected: PASS (all tests in the file, existing + new).

- [ ] **Step 5: Commit**

```bash
git add apps/driver/src/types/trip.ts apps/driver/src/store/useTripStore.ts apps/driver/tests/tripStore.test.js packages/shared/src/i18n/en.ts packages/shared/src/i18n/fil.ts
git commit -m "feat(driver): add per-passenger startPassenger action and ride-leg status tracking"
```

---

### Task 6: `apps/driver` — continuous location watch while online

**Files:**
- Create: `apps/driver/src/hooks/useDriverLocationSync.ts`
- Modify: `apps/driver/app/_layout.tsx`

**Interfaces:**
- Consumes: `pushDriverLocation` (Task 3); `useDriverStore`'s `isAvailable` (existing).
- Produces: `useDriverLocationSync(sessionUserId: string | null, isAvailable: boolean): void`, mounted alongside the other `use*Sync` hooks in `_layout.tsx`.

This hook wraps `expo-location`'s `watchPositionAsync`, which has no meaningful unit-testable pure logic (it's a thin side-effecting wrapper around a native API) — there is no dedicated test file for it, matching how `useLocationPermission` (already used elsewhere in `_layout.tsx`) has none either. Correctness here is verified by Task 12's manual device pass. TDD does not apply to this task; write the implementation directly.

- [ ] **Step 1: Implement the hook**

```typescript
// apps/driver/src/hooks/useDriverLocationSync.ts
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { pushDriverLocation } from '@trisakay/services/src/location/index.ts';

const DISTANCE_INTERVAL_METERS = 30;
const TIME_INTERVAL_MS = 8000;

/**
 * Keeps driver_profiles.current_lat/current_lng fresh while the driver is
 * available AND the app is foregrounded — no background-location permission
 * or task is used anywhere (see the feature's design doc, Decision 1). The
 * matching heuristic and any passenger watching this driver both read the
 * same column this writes to.
 */
export function useDriverLocationSync(sessionUserId: string | null, isAvailable: boolean): void {
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (subscriptionRef.current) return;
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      subscriptionRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: DISTANCE_INTERVAL_METERS, timeInterval: TIME_INTERVAL_MS },
        (position) => {
          void pushDriverLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        }
      );
    }

    function stop() {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    }

    function shouldRun() {
      return sessionUserId !== null && isAvailable && appStateRef.current === 'active';
    }

    if (shouldRun()) {
      void start();
    } else {
      stop();
    }

    const appStateSubscription = AppState.addEventListener('change', (next) => {
      appStateRef.current = next;
      if (shouldRun()) {
        void start();
      } else {
        stop();
      }
    });

    return () => {
      cancelled = true;
      stop();
      appStateSubscription.remove();
    };
  }, [sessionUserId, isAvailable]);
}
```

- [ ] **Step 2: Mount it in `_layout.tsx`**

```typescript
// apps/driver/app/_layout.tsx
import { useDriverLocationSync } from '../src/hooks/useDriverLocationSync';

// Inside RootLayoutNav(), alongside the other use*Sync calls:
  useDriverLocationSync(sessionUserId, isAvailable);
```

Place this call immediately after `useRequestsSync(sessionUserId, isAvailable);` (same two dependencies, same lifecycle reasoning: both are gated on `isAvailable` and owned session-wide).

- [ ] **Step 3: Manual smoke check (no automated test for this task)**

Run the driver app on a device/simulator with location permission granted, toggle available ON, and confirm (via `mcp__claude_ai_Supabase__execute_sql` polling `select current_lat, current_lng, location_updated_at from driver_profiles where user_id = '<test driver id>'`) that `location_updated_at` advances every ~8 seconds while stationary-but-jittering or while physically moving the test device, and stops advancing within a few seconds of toggling available OFF or backgrounding the app.

- [ ] **Step 4: Commit**

```bash
git add apps/driver/src/hooks/useDriverLocationSync.ts apps/driver/app/_layout.tsx
git commit -m "feat(driver): keep driver_profiles location fresh via foreground watchPositionAsync while online"
```

---

### Task 7: `apps/driver` — Start button on `trip/active.tsx`, Complete gated on `ongoing`

**Files:**
- Modify: `apps/driver/app/trip/active.tsx`
- Modify: `packages/shared/src/i18n/en.ts`
- Modify: `packages/shared/src/i18n/fil.ts`

**Interfaces:**
- Consumes: `useTripStore.startPassenger` (Task 5); `ActivePassenger.status` (Task 5).

No dedicated test file exists for `trip/active.tsx` itself (it's a screen component wiring together already-tested store logic; the codebase's existing pattern tests the store, not the screen — see how `completePassenger`/`cancelPassenger`'s screen wiring in this same file has no screen-level test either). Verified via Task 12's manual pass.

- [ ] **Step 1: Add the i18n key**

```typescript
// packages/shared/src/i18n/en.ts — inside driver.tripActive, next to `complete: 'Complete'`
      start: 'Start',
```

```typescript
// packages/shared/src/i18n/fil.ts — same location, Filipino equivalent following that file's existing tone for `complete`
      start: 'Simulan',
```

- [ ] **Step 2: Add the Start button and gate Complete**

```typescript
// apps/driver/app/trip/active.tsx

// 1. Pull startPassenger from the store, alongside the other trip actions:
  const startPassenger = useTripStore((state) => state.startPassenger);

// 2. Add local in-flight tracking, next to completingIds:
  const [startingIds, setStartingIds] = useState<Set<string>>(new Set());

// 3. Add the handler, next to handleComplete:
  async function handleStart(passengerId: string) {
    if (startingIds.has(passengerId)) return;
    setStartingIds((prev) => new Set(prev).add(passengerId));
    await startPassenger(passengerId);
    setStartingIds((prev) => {
      const next = new Set(prev);
      next.delete(passengerId);
      return next;
    });
  }

// 4. Inside the passenger .map(...), change:
          const canComplete = (!isCash || passenger.cashConfirmed) && !isCompleting;
// to:
          const isStarting = startingIds.has(passenger.id);
          const canComplete = passenger.status === 'ongoing' && (!isCash || passenger.cashConfirmed) && !isCompleting;

// 5. In the actions row, add a Start button before Complete, shown only pre-pickup:
              <View style={styles.actions}>
                <View style={styles.actionButton}>
                  <Button
                    label={t.common.cancel}
                    variant="outline"
                    tone="danger"
                    fullWidth
                    disabled={isCompleting || isStarting}
                    onPress={() => setCancellingId(passenger.id)}
                  />
                </View>
                {passenger.status === 'assigned' ? (
                  <View style={styles.actionButton}>
                    <Button
                      label={t.driver.tripActive.start}
                      fullWidth
                      loading={isStarting}
                      onPress={() => handleStart(passenger.id)}
                    />
                  </View>
                ) : (
                  <View style={styles.actionButton}>
                    <Button
                      label={t.driver.tripActive.complete}
                      fullWidth
                      disabled={!canComplete}
                      loading={isCompleting}
                      onPress={() => handleComplete(passenger)}
                    />
                  </View>
                )}
              </View>
```

- [ ] **Step 3: Manual verification**

Run the driver app, accept a request, confirm the passenger card shows "Start" (not "Complete") while `assigned`; tap Start, confirm it flips to a "Complete" button (disabled until cash is confirmed for a cash leg); confirm Complete succeeds only after Start has run (retrying the old assigned→completed shortcut should now fail server-side per Task 1's tightened `complete_ride_leg`, surfaced as the existing `completePassengerFailed` error copy).

- [ ] **Step 4: Commit**

```bash
git add apps/driver/app/trip/active.tsx packages/shared/src/i18n/en.ts packages/shared/src/i18n/fil.ts
git commit -m "feat(driver): add per-passenger Start action before Complete on the active trip screen"
```

---

### Task 8: `packages/ui` — non-remounting live driver marker on `OsmMap`

**Files:**
- Modify: `packages/ui/src/components/OsmMap/mapHtml.ts`
- Modify: `packages/ui/src/components/OsmMap/OsmMap.tsx`
- Test: `packages/ui/tests/mapHtml.test.ts` — check the exact existing filename first (Task context found `apps/passenger/tests/mapHtml.test.ts`; if `packages/ui` has its own `mapHtml.ts` test file already, extend that one instead of assuming the passenger app's copy — confirm via `Glob` for `**/mapHtml.test.ts` before writing, since this codebase may keep one canonical copy of `mapHtml.ts` re-used across apps, or a per-app fork. If `packages/ui`'s `mapHtml.ts` has no existing test file, create `packages/ui/tests/mapHtml.test.ts` following the same assertion style as whichever copy does have one.)

**Interfaces:**
- Produces: new `OsmMap` prop `liveDriverMarker?: { latitude: number; longitude: number } | null`; a `window.__setDriverLocation(lat, lng)` bridge function baked into the generated HTML whenever `marker` is set (the pickup pin becomes the line's fixed endpoint).

This is the one place the design's original plan needed correcting: continuously feeding a moving point into the existing `route` prop would rebuild the memoized HTML `source` on every location update (its memo key includes `JSON.stringify(route ?? null)`), remounting the WebView and re-fetching every map tile on each ~8-second GPS fix — directly against this file's own documented OSM tile-usage constraints ("no bulk downloading / tile pre-fetching"). Instead, this task adds a second, independently-updatable marker plus connecting line, moved via `injectJavaScript` — the same bridge mechanism already used for the recenter button (`RECENTER_JS`) — so the WebView and its tiles are never rebuilt after the initial `ready` state.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/ui/tests/mapHtml.test.ts (or append to the existing file found above)
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMapHtml } from '../src/components/OsmMap/mapHtml.ts';

test('buildMapHtml exposes window.__setDriverLocation when a marker is present', () => {
  const html = buildMapHtml({
    latitude: 6.1164,
    longitude: 125.1717,
    zoom: 15,
    marker: { latitude: 6.1164, longitude: 125.1717 },
  });
  assert.ok(html.includes('window.__setDriverLocation'));
});

test('buildMapHtml does not remount-relevant content change when only marker coordinates would differ — the bridge function reads live pin coordinates, not baked-in ones', () => {
  // The bridge function must reference `pin.getLatLng()` (the pickup marker's
  // live position) rather than a second hard-coded lat/lng pair, so that a
  // caller can rely on it drawing the line to wherever the pickup pin already
  // is without rebuilding the HTML string.
  const html = buildMapHtml({
    latitude: 6.1164,
    longitude: 125.1717,
    zoom: 15,
    marker: { latitude: 6.1164, longitude: 125.1717 },
  });
  assert.ok(html.includes('pin.getLatLng()'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ui && node --test ./tests/mapHtml.test.ts` (adjust path to wherever Step 1 of this task determined the real test file lives)
Expected: FAIL — `window.__setDriverLocation` is not in the generated HTML yet.

- [ ] **Step 3: Implement the bridge function in `mapHtml.ts`**

Add, right after the existing `pin`/`HAS_MARKER` block (after the `if (HAS_MARKER) { ... }` closes, before `TAP_TO_PLACE`):

```javascript
    var driverMarker = null;
    var driverLine = null;
    var driverIcon = L.divIcon({
      className: '',
      html: '<div style="width:22px;height:22px;border-radius:50%;background:${colors.accentGreen};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    window.__setDriverLocation = function (lat, lng) {
      if (!pin) return; // no fixed pickup point to draw a line to
      var pinPos = pin.getLatLng();
      var point = [lat, lng];
      if (!driverMarker) {
        driverMarker = L.marker(point, { icon: driverIcon }).addTo(map);
        driverLine = L.polyline([point, [pinPos.lat, pinPos.lng]], { color: '${colors.accentGreen}', weight: 4, dashArray: '6,6', opacity: 0.85 }).addTo(map);
      } else {
        driverMarker.setLatLng(point);
        driverLine.setLatLngs([point, [pinPos.lat, pinPos.lng]]);
      }
    };
    window.__clearDriverLocation = function () {
      if (driverMarker) { map.removeLayer(driverMarker); driverMarker = null; }
      if (driverLine) { map.removeLayer(driverLine); driverLine = null; }
    };
```

This must be emitted unconditionally whenever `HAS_MARKER` is true (i.e., inside the same `if (HAS_MARKER) { ... }` block, appended after the existing `pin.on('dragend', ...)` call) — it's meaningless without a pickup pin to draw the line to, matching the early-return in `__setDriverLocation` itself.

- [ ] **Step 4: Add the `OsmMap.tsx` prop and injection effect**

```typescript
// packages/ui/src/components/OsmMap/OsmMap.tsx

// 1. Add to OsmMapProps:
  /**
   * A second, independently-moving marker (the matched driver's live
   * position) plus a connecting line to the fixed `marker` pin. Updated via
   * injectJavaScript, NOT baked into the memoized HTML `source` — unlike
   * `marker`'s own coordinates, this is expected to change every few seconds
   * and must never remount the WebView / re-fetch tiles. Requires `marker`
   * to also be set; a no-op otherwise.
   */
  liveDriverMarker?: { latitude: number; longitude: number } | null;

// 2. Destructure it in the function signature:
  liveDriverMarker = null,

// 3. Add an effect, after the existing handleRecenter useCallback:
  useEffect(() => {
    if (state !== 'ready') return;
    if (liveDriverMarker) {
      webViewRef.current?.injectJavaScript(
        `window.__setDriverLocation && window.__setDriverLocation(${liveDriverMarker.latitude}, ${liveDriverMarker.longitude}); true;`
      );
    } else {
      webViewRef.current?.injectJavaScript('window.__clearDriverLocation && window.__clearDriverLocation(); true;');
    }
  }, [state, liveDriverMarker?.latitude, liveDriverMarker?.longitude]);
```

Do NOT add `liveDriverMarker` to the `source` memo's dependency array in Step 1's existing `useMemo` — that's the entire point of this task (see the task-level rationale above).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/ui && node --test ./tests/mapHtml.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/OsmMap/mapHtml.ts packages/ui/src/components/OsmMap/OsmMap.tsx packages/ui/tests/mapHtml.test.ts
git commit -m "feat(ui): add a live-updating driver marker to OsmMap without remounting the WebView"
```

---

### Task 9: `apps/passenger` — carry the driver's photo through

**Files:**
- Modify: `apps/passenger/src/types/driver.ts`
- Modify: `apps/passenger/app/booking/finding-driver.tsx`
- Modify: `apps/passenger/src/components/DriverInfoCard/DriverInfoCard.tsx`

**Interfaces:**
- Produces: `Driver.avatarUrl: string | null` (new field).

No dedicated test file covers `finding-driver.tsx` or `DriverInfoCard.tsx` today (same situation as Task 7 — screen-level wiring, not unit-tested in this codebase's existing pattern). Verified via Task 12's manual pass.

- [ ] **Step 1: Add the field to `Driver`**

```typescript
// apps/passenger/src/types/driver.ts
export interface Driver {
  id: string;
  name: string;
  plateNumber: string;
  rating: number | null;
  etaMinutes: number | null;
  /** Null when the driver has no uploaded profile photo. */
  avatarUrl: string | null;
}
```

- [ ] **Step 2: Stop dropping it in `finding-driver.tsx`**

```typescript
// apps/passenger/app/booking/finding-driver.tsx — in applyDriverAndAdvance:
      setDriver({
        id: data?.driverId ?? '',
        name: data?.driverName ?? '',
        plateNumber: data?.plateNo ?? '',
        rating: data?.ratingAvg ?? null,
        etaMinutes: null,
        avatarUrl: data?.avatarUrl ?? null,
      });
```

- [ ] **Step 3: Render it in `DriverInfoCard`**

```typescript
// apps/passenger/src/components/DriverInfoCard/DriverInfoCard.tsx
        <Avatar
          name={driver.name}
          source={driver.avatarUrl ? { uri: driver.avatarUrl } : undefined}
          size="lg"
        />
```

- [ ] **Step 4: Manual verification**

Complete a match on the passenger app with a driver account that has an uploaded profile photo; confirm the trip screen shows that photo instead of initials.

- [ ] **Step 5: Commit**

```bash
git add apps/passenger/src/types/driver.ts apps/passenger/app/booking/finding-driver.tsx apps/passenger/src/components/DriverInfoCard/DriverInfoCard.tsx
git commit -m "fix(passenger): stop dropping the matched driver's photo"
```

---

### Task 10: `apps/passenger` — live tracking, ETA, and the `ongoing` state on `booking/trip.tsx`

**Files:**
- Modify: `apps/passenger/app/booking/trip.tsx`
- Modify: `packages/shared/src/i18n/en.ts`
- Modify: `packages/shared/src/i18n/fil.ts`

**Interfaces:**
- Consumes: `subscribeToDriverLocation` (Task 3), `estimateEtaMinutes`/`haversineKm`/`ASSUMED_TRICYCLE_SPEED_KMH` (Task 2), `liveDriverMarker` prop on `OsmMap` (Task 8), `useBookingStore`'s `pickup`/`driver` (existing).

No dedicated test file exists for this screen (same reasoning as Tasks 7/9). Verified via Task 12's manual pass — this is inherently a Realtime + RLS + native-map integration, exactly the kind of thing unit tests can't catch, per the design spec's own testing section.

- [ ] **Step 1: Track ride status locally, not just completed/cancelled**

The existing `subscribeToRideRequestStatus` effect only branches on `'completed'`/`'cancelled'`. Add a `rideStatus` state so the screen can also react to `'assigned'` (tracking on) vs `'ongoing'` (tracking off):

```typescript
// apps/passenger/app/booking/trip.tsx
import { useEffect, useRef, useState } from 'react';
import { estimateEtaMinutes, haversineKm, ASSUMED_TRICYCLE_SPEED_KMH } from '@trisakay/shared';
import { subscribeToDriverLocation, subscribeToRideRequestStatus, type DriverLocation } from '@trisakay/services';

// Inside TripScreen(), alongside the existing state:
  const [rideStatus, setRideStatus] = useState<'assigned' | 'ongoing'>('assigned');
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);

// In the existing subscribeToRideRequestStatus callback, add a branch:
        if (row.status === 'ongoing') {
          setRideStatus('ongoing');
        } else if (row.status === 'completed') {
          // ...unchanged existing branch
        } else if (row.status === 'cancelled') {
          // ...unchanged existing branch
        }
```

Verify the actual import path/name `@trisakay/shared` exports `ASSUMED_TRICYCLE_SPEED_KMH`/`estimateEtaMinutes`/`haversineKm` (Task 2 re-exports them via that package's root `index.ts`, which already does `export * from './constants/index.ts'` and `export * from './utils/index.ts'`) — confirm the passenger app's existing imports elsewhere in this same file use `@trisakay/shared` as the package specifier (or find the actual one via `Grep` for `@trisakay/shared` inside `apps/passenger` if uncertain) before finalizing this import line.

- [ ] **Step 2: Subscribe to the driver's live location while `assigned`**

```typescript
// apps/passenger/app/booking/trip.tsx — new effect, alongside the existing rideRequestId effect
  useEffect(() => {
    if (rideStatus !== 'assigned' || !driver?.id) {
      setDriverLocation(null);
      return;
    }
    const unsubscribe = subscribeToDriverLocation(driver.id, setDriverLocation);
    return unsubscribe;
  }, [rideStatus, driver?.id]);
```

- [ ] **Step 3: Compute ETA from live location and render the map/ETA conditionally**

```typescript
// apps/passenger/app/booking/trip.tsx

  const etaMinutes =
    driverLocation && pickup
      ? estimateEtaMinutes(haversineKm(driverLocation.lat, driverLocation.lng, pickup.latitude, pickup.longitude), ASSUMED_TRICYCLE_SPEED_KMH)
      : null;

  const driverForCard = { ...driver, etaMinutes };
```

Replace the `<OsmMap variant="route" ... />` block with:

```typescript
        <OsmMap
          variant="route"
          caption={rideStatus === 'assigned' ? t.trip.mapCaption : t.trip.tripInProgressCaption}
          height="100%"
          latitude={pickup?.latitude}
          longitude={pickup?.longitude}
          zoom={15}
          interactive
          edgeToEdge
          marker={pickup ? { latitude: pickup.latitude, longitude: pickup.longitude } : null}
          liveDriverMarker={rideStatus === 'assigned' && driverLocation ? { latitude: driverLocation.lat, longitude: driverLocation.lng } : null}
        />
```

And pass `driverForCard` (not `driver`) to `<DriverInfoCard driver={driverForCard} />` so the ETA badge reflects the live-computed value instead of the permanently-null value `finding-driver.tsx` sets at match time.

Add a status badge distinction: change the existing `<Badge label={t.trip.driverAssigned} ... />` to read `label={rideStatus === 'assigned' ? t.trip.driverAssigned : t.trip.tripInProgress}`.

- [ ] **Step 4: Add the new copy keys**

```typescript
// packages/shared/src/i18n/en.ts — inside the `trip` section, alongside the existing mapCaption/driverAssigned keys
      tripInProgressCaption: 'Trip in progress',
      tripInProgress: 'Trip in progress',
```

```typescript
// packages/shared/src/i18n/fil.ts — same location, Filipino equivalent matching that file's existing tone
      tripInProgressCaption: 'Ongoing na ang biyahe',
      tripInProgress: 'Ongoing na ang biyahe',
```

- [ ] **Step 5: Manual verification**

Run both apps together on two devices/simulators: driver accepts, passenger's trip screen shows the driver's marker moving and an ETA badge updating roughly every 8 seconds; driver taps Start (Task 7); confirm the passenger's screen immediately swaps to the "trip in progress" caption/badge and the driver marker disappears (both because `rideStatus` flips locally via Realtime, and — independently — because RLS revokes the passenger's read access to that driver's location the instant the leg leaves `'assigned'`, so even a stale client would stop receiving updates).

- [ ] **Step 6: Commit**

```bash
git add apps/passenger/app/booking/trip.tsx packages/shared/src/i18n/en.ts packages/shared/src/i18n/fil.ts
git commit -m "feat(passenger): show live driver location, straight-line ETA, and trip-in-progress state"
```

---

### Task 11: Full-flow manual verification (no code changes)

**Files:** none — this task is a checklist, not a diff.

- [ ] **Step 1: Re-run every automated test suite touched by this plan**

```bash
cd packages/shared && node --test ./tests/*.test.ts
cd packages/services && node --test ./tests/*.test.ts
cd packages/ui && node --test ./tests/*.test.ts
cd apps/driver && node --test ./tests/*.test.js
```

Expected: all PASS, including every pre-existing test (this plan must not regress anything already green).

- [ ] **Step 2: Two-device manual walkthrough**

Using one device/simulator as a verified test driver and one as a test passenger against the real `ygdgbvxxqrkxlezpckif` project (test-mode, no real money per FR-9.6):
1. Passenger requests a ride; driver (already toggled online) sees it on the request board and accepts.
2. Confirm the passenger's trip screen shows the driver's live marker, a dashed line to the pickup pin, and an ETA badge that updates as the driver device's location changes (physically move the driver device, or use a simulator's location-simulation feature).
3. Confirm the driver's photo (if the test driver account has one uploaded) renders on the passenger's card instead of initials.
4. On the driver app, confirm the passenger card shows a **Start** button, not Complete, while `assigned`.
5. Tap Start; confirm the passenger's screen immediately switches to the trip-in-progress state (no more live marker/ETA) and the driver's card now shows Complete.
6. For a cash-method leg, confirm Complete stays disabled until "Confirm cash received" is toggled; for GCash, confirm it completes without that step.
7. Complete the leg; confirm the passenger proceeds through payment (unchanged) into rating (unchanged).
8. Toggle the driver offline mid-idle (no active passengers) and confirm any previously-granted `driver_select_matched_passenger` access for a past, now-completed ride request no longer returns rows (query `driver_profiles` as that passenger's session, or simply confirm no stale subscription is still open client-side).

- [ ] **Step 3: Report results**

Summarize pass/fail for each of the 8 walkthrough points above before considering this feature done. Any failure sends the relevant task back for a fix-and-recommit, not a new task.

---

## Self-Review Notes

- **Spec coverage:** All of sections A (RLS + `start_ride_leg` + `complete_ride_leg` tightening + `get_active_trip_passengers` status), B (`startRideLeg`, `subscribeToDriverLocation`/`pushDriverLocation`, ETA constant), C (location-sync hook, Start button, store action), D (photo fix, live tracking on `trip.tsx`), E (i18n), and F (testing discipline) are each covered by a task above. The spec's D.1 claim that `getTripDriverInfo()` already returns location was found to be **incorrect** during Task 1's live-schema verification — it does not, and does not need to; Task 10 sources location purely from the Realtime subscription instead, which is simpler than the spec originally proposed and requires no change to `get_trip_driver_info`.
- **Corrected during planning, not in the original spec:** Task 8's non-remounting marker mechanism. The spec's D.2 said to "render the driver's live marker on the existing `OsmMap`" without addressing that `OsmMap`'s HTML is memoized and rebuilds (remounting the WebView, re-fetching every tile) whenever the `route` prop's serialized content changes — which a naive per-update `route` prop would trigger every ~8 seconds. This is an implementation-detail fix within the same architecture (still no routing engine, still client-side straight-line computation), not a scope change.
- **Placeholder scan:** no TBD/TODO left in any task; the one open item (confirming which `mapHtml.test.ts` file is canonical in Task 8) is phrased as an explicit verification step with a fallback action, not a placeholder.
- **Type consistency:** `ActivePassenger.status`/`ActiveTripPassenger.status` both use `'assigned' | 'ongoing'` (driver-side) — `ActiveTripPassenger.status` is typed against the full `ride_status` enum from generated types (Task 4) since it comes straight off the RPC row, while `ActivePassenger.status` (Task 5, UI-facing) is narrowed to just the two statuses ever seen client-side (`'ongoing'`/`'assigned'`/`'completed'`/`'cancelled'` legs are filtered out server-side before reaching the client) — consistent with the existing narrowing already done for `paymentMethod`/other fields in that same file. `DriverLocation` (Task 3) is used identically in Task 10.
