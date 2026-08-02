# Ride Request Insert, Cancel & Realtime Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the passenger app's fake ride-request flow (`setTripStatus('searching')` + a random-delay fake driver match) with a real `ride_requests` insert, a real cancel, and a real Realtime subscription — backlog item 4 in `docs/PASSENGER_TODO.MD`.

**Architecture:** A new `packages/services/src/booking` module wraps three Supabase operations (`createRideRequest`, `cancelRideRequest`, `subscribeToRideRequestStatus`) behind the same `{data, error}` convention already used by `packages/services/src/fare` and `.../discount`. `confirm.tsx` calls `createRideRequest` on submit; `finding-driver.tsx` calls `subscribeToRideRequestStatus` on mount and `cancelRideRequest` on cancel. No new backend code — the table, RLS policies, and Realtime publication already exist (`docs/SCHEMA.MD`).

**Tech Stack:** TypeScript, `@supabase/supabase-js` (Realtime `postgres_changes`), Zustand, Expo Router, `node --test` with the existing `createFakeSupabaseClient` test harness.

## Global Constraints

- Every service function returns `{data, error}` / `{error}` — never throws to the caller. (Spec: "Design")
- `cancelRideRequest` must treat a 0-row RLS-rejected update as an error, not silent success. (Spec: `cancelRideRequest`)
- `finding-driver.tsx` must not simulate a driver match — no fake timers, no `pickRandomDriver`. (Spec: "Problem", "Design")
- Item 5's screens (`driver-found.tsx` cancel button, `trip-in-progress.tsx`) are out of scope — do not touch their fake `wait()` chains. (Spec: "Explicitly out of scope")
- `src/mocks/drivers.ts` must be deleted once its only caller is removed — no dead code left behind. (Spec: "Cleanup")

---

### Task 1: Booking service — `createRideRequest`

**Files:**
- Modify: `packages/services/tests/fakeSupabaseClient.ts`
- Create: `packages/services/tests/booking.test.ts`
- Modify: `packages/services/src/booking/index.ts` (currently a one-line stub: `export const bookingServiceStatus = 'Booking service ready';` — this line is deleted, not kept alongside the new exports)

**Interfaces:**
- Consumes: `getSupabaseClient()` from `../supabase/client.ts`; `Database` type from `../supabase/database.types.ts`; `__setSupabaseClientForTests` / `createFakeSupabaseClient` (test harness, extended by this task).
- Produces: `RideRequestRow` (type alias), `CreateRideRequestInput`, `CreateRideRequestResult`, `createRideRequest(input: CreateRideRequestInput): Promise<CreateRideRequestResult>` — consumed by Task 5 (`confirm.tsx`).

- [ ] **Step 1: Add a generic `from`/`channel`/`removeChannel` escape hatch to the fake Supabase client**

The existing fake only knows about `users` and `user_consents` tables and has no `channel()` at all. Add generic overrides so any test (this one and Task 3's) can supply its own table/channel behavior without more hardcoded tables.

Edit `packages/services/tests/fakeSupabaseClient.ts` — add to `FakeClientConfig`:

```ts
  /** Full override for `.from(table)` — when set, bypasses the built-in users/consents tables entirely. */
  from?: (table: string) => unknown;
  /** Full override for `.channel(name)` — used by Realtime-subscription tests. */
  channel?: (name: string) => unknown;
  removeChannel?: (channel: unknown) => void;
```

And change the bottom of `createFakeSupabaseClient` from:

```ts
  const from = (table: string) => (table === 'user_consents' ? consentsTable : usersTable);

  return { auth, from } as unknown as SupabaseClient<Database>;
```

to:

```ts
  const from = (table: string) => {
    if (config.from) return config.from(table);
    return table === 'user_consents' ? consentsTable : usersTable;
  };

  return {
    auth,
    from,
    channel: config.channel ?? (() => { throw new Error('channel not configured on fake client'); }),
    removeChannel: config.removeChannel ?? (() => {}),
  } as unknown as SupabaseClient<Database>;
```

- [ ] **Step 2: Write the failing tests**

Create `packages/services/tests/booking.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import { createRideRequest } from '../src/booking/index.ts';

test('createRideRequest inserts the full payload and returns the row', async () => {
  let capturedInsert: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: (table) => {
        assert.equal(table, 'ride_requests');
        return {
          insert: (row: unknown) => {
            capturedInsert = row;
            return {
              select: () => ({
                single: async () => ({ data: { id: 'rr1', ...(row as object) }, error: null }),
              }),
            };
          },
        };
      },
    })
  );

  const { data, error } = await createRideRequest({
    passengerId: 'p1',
    pickup: { latitude: 6.11, longitude: 125.17, label: 'Home' },
    dropoff: { latitude: 6.12, longitude: 125.18, label: 'Mall' },
    seats: 2,
    distanceKm: 1.4,
    estimatedFare: 18,
    preferredMethod: 'cash',
    discountApplied: true,
    discountPercent: 20,
  });

  assert.equal(error, null);
  assert.equal(data?.id, 'rr1');
  assert.deepEqual(capturedInsert, {
    passenger_id: 'p1',
    pickup_lat: 6.11,
    pickup_lng: 125.17,
    pickup_label: 'Home',
    dest_lat: 6.12,
    dest_lng: 125.18,
    dest_label: 'Mall',
    seats_requested: 2,
    distance_km: 1.4,
    estimated_fare: 18,
    preferred_method: 'cash',
    discount_applied: true,
    discount_percent: 20,
  });
});

test('createRideRequest surfaces the Postgres error message', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: { message: 'insert failed' } }),
          }),
        }),
      }),
    })
  );

  const { data, error } = await createRideRequest({
    passengerId: 'p1',
    pickup: { latitude: 0, longitude: 0, label: 'A' },
    dropoff: { latitude: 0, longitude: 0, label: 'B' },
    seats: 1,
    distanceKm: 1,
    estimatedFare: 15,
    preferredMethod: 'cash',
    discountApplied: false,
    discountPercent: null,
  });

  assert.equal(data, null);
  assert.equal(error, 'insert failed');
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd packages/services && node --test ./tests/booking.test.ts`
Expected: FAIL — `createRideRequest` is not exported from `../src/booking/index.ts`.

- [ ] **Step 4: Implement `createRideRequest`**

Replace the contents of `packages/services/src/booking/index.ts` with:

```ts
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd packages/services && node --test ./tests/booking.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/services/tests/fakeSupabaseClient.ts packages/services/tests/booking.test.ts packages/services/src/booking/index.ts
git commit -m "feat(services): add createRideRequest for the passenger booking flow"
```

---

### Task 2: Booking service — `cancelRideRequest`

**Files:**
- Modify: `packages/services/tests/booking.test.ts`
- Modify: `packages/services/src/booking/index.ts`

**Interfaces:**
- Consumes: the `from` override added in Task 1.
- Produces: `CancelRideRequestResult`, `cancelRideRequest(rideRequestId: string, reason: string): Promise<CancelRideRequestResult>` — consumed by Task 6 (`finding-driver.tsx`).

- [ ] **Step 1: Write the failing tests**

Append to `packages/services/tests/booking.test.ts`:

```ts
import { cancelRideRequest } from '../src/booking/index.ts';

test('cancelRideRequest updates status to cancelled and returns no error on success', async () => {
  let capturedUpdate: any = null;
  let capturedId: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: (table) => {
        assert.equal(table, 'ride_requests');
        return {
          update: (row: unknown) => {
            capturedUpdate = row;
            return {
              eq: (column: string, value: unknown) => {
                assert.equal(column, 'id');
                capturedId = value;
                return {
                  select: () => ({
                    maybeSingle: async () => ({ data: { id: value, status: 'cancelled' }, error: null }),
                  }),
                };
              },
            };
          },
        };
      },
    })
  );

  const { error } = await cancelRideRequest('rr1', 'Cancelled by passenger');
  assert.equal(error, null);
  assert.equal(capturedId, 'rr1');
  assert.equal(capturedUpdate.status, 'cancelled');
  assert.equal(capturedUpdate.cancel_reason, 'Cancelled by passenger');
});

test('cancelRideRequest reports a plain error when RLS rejects the update (already assigned)', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: () => ({
        update: () => ({
          eq: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    })
  );

  const { error } = await cancelRideRequest('rr1', 'Cancelled by passenger');
  assert.equal(error, 'Could not cancel — this ride may already be assigned.');
});

test('cancelRideRequest surfaces a genuine Postgres error', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: () => ({
        update: () => ({
          eq: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: null, error: { message: 'network error' } }),
            }),
          }),
        }),
      }),
    })
  );

  const { error } = await cancelRideRequest('rr1', 'Cancelled by passenger');
  assert.equal(error, 'network error');
});
```

(Move the `import { createRideRequest } ...` and this new `import { cancelRideRequest } ...` into one combined import line at the top of the file instead of two separate import statements — either ordering is fine as long as the file has exactly one import from `'../src/booking/index.ts'`.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/services && node --test ./tests/booking.test.ts`
Expected: FAIL — `cancelRideRequest` is not exported.

- [ ] **Step 3: Implement `cancelRideRequest`**

Append to `packages/services/src/booking/index.ts`:

```ts
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
  if (!data) return { error: 'Could not cancel — this ride may already be assigned.' };
  return { error: null };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/services && node --test ./tests/booking.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/services/tests/booking.test.ts packages/services/src/booking/index.ts
git commit -m "feat(services): add cancelRideRequest, rejecting non-pending cancels"
```

---

### Task 3: Booking service — `subscribeToRideRequestStatus`

**Files:**
- Modify: `packages/services/tests/booking.test.ts`
- Modify: `packages/services/src/booking/index.ts`

**Interfaces:**
- Consumes: the `channel`/`removeChannel` overrides added in Task 1.
- Produces: `RideRequestStatusUpdate`, `subscribeToRideRequestStatus(rideRequestId: string, onChange: (row: RideRequestStatusUpdate) => void): () => void` — consumed by Task 6 (`finding-driver.tsx`).

- [ ] **Step 1: Write the failing test**

Append to `packages/services/tests/booking.test.ts` (add `subscribeToRideRequestStatus` to the existing import from `'../src/booking/index.ts'`):

```ts
test('subscribeToRideRequestStatus filters on the row id and forwards status updates', async () => {
  let capturedArgs: any = null;
  let capturedHandler: ((payload: unknown) => void) | null = null;
  let subscribeCalled = false;
  let removedChannel: unknown = null;
  const fakeChannel = {
    on: (_event: string, filterArgs: unknown, handler: (payload: unknown) => void) => {
      capturedArgs = filterArgs;
      capturedHandler = handler;
      return fakeChannel;
    },
    subscribe: () => {
      subscribeCalled = true;
      return fakeChannel;
    },
  };

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      channel: (name: string) => {
        assert.equal(name, 'ride_request_status_rr1');
        return fakeChannel;
      },
      removeChannel: (channel: unknown) => {
        removedChannel = channel;
      },
    })
  );

  const received: unknown[] = [];
  const unsubscribe = subscribeToRideRequestStatus('rr1', (row) => received.push(row));

  assert.equal(capturedArgs.filter, 'id=eq.rr1');
  assert.equal(capturedArgs.event, 'UPDATE');
  assert.equal(capturedArgs.table, 'ride_requests');
  assert.ok(subscribeCalled);

  capturedHandler?.({ new: { id: 'rr1', status: 'assigned' } });
  assert.deepEqual(received, [{ id: 'rr1', status: 'assigned' }]);

  unsubscribe();
  assert.equal(removedChannel, fakeChannel);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/services && node --test ./tests/booking.test.ts`
Expected: FAIL — `subscribeToRideRequestStatus` is not exported.

- [ ] **Step 3: Implement `subscribeToRideRequestStatus`**

Append to `packages/services/src/booking/index.ts`:

```ts
export type RideRequestStatusUpdate = Pick<RideRequestRow, 'id' | 'status'>;

/** First Realtime subscription in this codebase — one row, one channel, torn down by the returned unsubscribe. */
export function subscribeToRideRequestStatus(
  rideRequestId: string,
  onChange: (row: RideRequestStatusUpdate) => void,
): () => void {
  const client = getSupabaseClient();
  const channel = client
    .channel(`ride_request_status_${rideRequestId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'ride_requests', filter: `id=eq.${rideRequestId}` },
      (payload: { new: RideRequestStatusUpdate }) => onChange(payload.new),
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
```

- [ ] **Step 4: Run the full booking test file to verify everything passes**

Run: `cd packages/services && node --test ./tests/booking.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Run the whole services test suite to check for regressions**

Run: `cd packages/services && npm test`
Expected: PASS (all files, including `auth.test.ts`, `consents.test.ts`, `client.test.ts`)

- [ ] **Step 6: Commit**

```bash
git add packages/services/tests/booking.test.ts packages/services/src/booking/index.ts
git commit -m "feat(services): add subscribeToRideRequestStatus for realtime ride-status updates"
```

---

### Task 4: `useBookingStore` — track the active ride request id

**Files:**
- Modify: `apps/passenger/src/store/useBookingStore.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `rideRequestId: string | null` field and `setRideRequestId: (id: string | null) => void` action on `useBookingStore` — consumed by Task 5 (`confirm.tsx`) and Task 6 (`finding-driver.tsx`).

This is a one-line state addition with no branching logic (mirrors the existing `driver`/`setDriver` field) — no dedicated unit test, verified end-to-end by Tasks 5–6's manual verification.

- [ ] **Step 1: Add the field**

In `apps/passenger/src/store/useBookingStore.ts`, add `rideRequestId: string | null` to the `BookingState` interface (after `driver: Driver | null;`) and `setRideRequestId: (id: string | null) => void;` to the actions section (after `setDriver`).

- [ ] **Step 2: Add it to initial state, the store body, and reset**

In `initialState`, add:

```ts
  rideRequestId: null as string | null,
```

(after `driver: null as Driver | null,`).

In the store body, add:

```ts
  setRideRequestId: (id) => set({ rideRequestId: id }),
```

(after `setDriver: (driver) => set({ driver }),`). `reset: () => set({ ...initialState })` already spreads `initialState`, so it picks up `rideRequestId: null` automatically — no change needed there.

- [ ] **Step 3: Typecheck**

Run: `cd apps/passenger && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/passenger/src/store/useBookingStore.ts
git commit -m "feat(passenger): track the active ride_requests row id in booking store"
```

---

### Task 5: `confirm.tsx` — real insert on "Request ride"

**Files:**
- Modify: `apps/passenger/app/booking/confirm.tsx`
- Modify: `apps/passenger/src/styles/booking/confirm.styles.ts`

**Interfaces:**
- Consumes: `createRideRequest` (Task 1), `useBookingStore().rideRequestId` / `setRideRequestId` (Task 4).
- Produces: nothing new for later tasks (leaf screen change).

- [ ] **Step 1: Add the request-error style**

In `apps/passenger/src/styles/booking/confirm.styles.ts`, add after `discountLink`:

```ts
  requestError: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
```

- [ ] **Step 2: Wire the real insert**

In `apps/passenger/app/booking/confirm.tsx`:

1. Add one more piece of local state near `fareError` (`useState` is already imported):

```ts
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
```

2. Pull the new store fields alongside the existing ones (add after the existing `setTripStatus` line):

```ts
  const rideRequestId = useBookingStore((state) => state.rideRequestId);
  const setRideRequestId = useBookingStore((state) => state.setRideRequestId);
```

3. Replace the `handleRequestRide` function. `confirm.tsx` already lazy-imports `@trisakay/services` inside effects (see the existing `import('@trisakay/services').then(...)` calls) instead of a static top-level import — follow that same pattern here too:

```ts
  async function handleRequestRide() {
    if (!pickup || !dropoff || fare === null || !user?.id) return;

    setIsRequesting(true);
    setRequestError(null);

    const { createRideRequest } = await import('@trisakay/services');
    const distanceKm = haversineDistanceKm(pickup, dropoff);
    const { data, error } = await createRideRequest({
      passengerId: user.id,
      pickup: { latitude: pickup.latitude, longitude: pickup.longitude, label: pickup.label },
      dropoff: { latitude: dropoff.latitude, longitude: dropoff.longitude, label: dropoff.label },
      seats,
      distanceKm,
      estimatedFare: fare,
      preferredMethod: paymentMethod,
      discountApplied: discountApproved === true,
      discountPercent: discountApproved === true ? (discountRatePercent ?? 20) : null,
    });

    setIsRequesting(false);

    if (error || !data) {
      setRequestError(error ?? 'Could not request a ride. Please try again.');
      return;
    }

    setRideRequestId(data.id);
    setTripStatus('searching');
    router.push('/booking/finding-driver');
  }
```

4. Update the "Request ride" button to reflect fare-readiness and the in-flight request, and show `requestError`:

```tsx
        <Button
          label="Request ride"
          fullWidth
          loading={isRequesting}
          disabled={!isGranted || fare === null || fareError !== null || isRequesting}
          // Only while disabled — an enabled button must not announce a reason
          // that no longer applies.
          accessibilityHint={isGranted ? undefined : LOCATION_REQUIRED_HINT}
          onPress={handleRequestRide}
        />
        {requestError && <Text style={styles.requestError}>{requestError}</Text>}
        <LocationRequiredNotice />
```

(Replaces the existing `<Button label="Request ride" ... />` + `<LocationRequiredNotice />` block in the `footer` view.)

- [ ] **Step 3: Typecheck**

Run: `cd apps/passenger && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verification against the live Supabase project**

Start the app (`npm run start` in `apps/passenger` or the repo-root equivalent), sign in as a passenger, set a pickup and destination, wait for a fare quote, tap "Request ride". Confirm:
- A new row appears in `public.ride_requests` (via Supabase Studio or `mcp__plugin_supabase` table browser) with matching `pickup_lat/lng`, `dest_lat/lng`, `seats_requested`, `estimated_fare`, `preferred_method`, and `status = 'pending'`.
- The app navigates to `finding-driver.tsx` without a fake driver appearing (Task 6 makes this literal — if Task 6 isn't done yet, the old fake timer will still fire; re-verify this specific point after Task 6).

- [ ] **Step 5: Commit**

```bash
git add apps/passenger/app/booking/confirm.tsx apps/passenger/src/styles/booking/confirm.styles.ts
git commit -m "feat(passenger): insert a real ride_requests row on Request ride"
```

---

### Task 6: `finding-driver.tsx` — real cancel + realtime wait, remove the fake match

**Files:**
- Modify: `apps/passenger/app/booking/finding-driver.tsx`
- Modify: `apps/passenger/src/styles/booking/finding-driver.styles.ts`
- Delete: `apps/passenger/src/mocks/drivers.ts`
- Modify: `apps/passenger/DESIGN.md:132`

**Interfaces:**
- Consumes: `cancelRideRequest`, `subscribeToRideRequestStatus`, `RideRequestStatusUpdate` (Task 3), `useBookingStore().rideRequestId` (Task 4).
- Produces: nothing new for later tasks (leaf screen change).

- [ ] **Step 1: Add a cancel-error style**

In `apps/passenger/src/styles/booking/finding-driver.styles.ts`, add after `cancelButton`:

```ts
  cancelError: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
```

- [ ] **Step 2: Rewrite the screen**

Replace the full contents of `apps/passenger/app/booking/finding-driver.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Button, OsmMap, colors } from '@trisakay/ui';
import { PulseBeacon } from '../../src/components/PulseBeacon';
import { useBookingStore } from '../../src/store/useBookingStore';
import { styles } from '../../src/styles/booking/finding-driver.styles';

export default function FindingDriverScreen() {
  const router = useRouter();
  const pickup = useBookingStore((state) => state.pickup);
  const dropoff = useBookingStore((state) => state.dropoff);
  const rideRequestId = useBookingStore((state) => state.rideRequestId);
  const setTripStatus = useBookingStore((state) => state.setTripStatus);
  const reset = useBookingStore((state) => state.reset);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    if (!rideRequestId) {
      router.replace('/(tabs)/home');
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    import('@trisakay/services').then(({ subscribeToRideRequestStatus }) => {
      if (cancelled) return;
      unsubscribe = subscribeToRideRequestStatus(rideRequestId, (row) => {
        if (row.status === 'assigned') {
          setTripStatus('matched');
          router.replace('/booking/driver-found');
        } else if (row.status === 'cancelled') {
          reset();
          router.replace('/(tabs)/home');
        }
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideRequestId]);

  async function handleCancel() {
    if (!rideRequestId) return;

    setIsCancelling(true);
    setCancelError(null);

    const { cancelRideRequest } = await import('@trisakay/services');
    const { error } = await cancelRideRequest(rideRequestId, 'Cancelled by passenger');

    setIsCancelling(false);

    if (error) {
      setCancelError(error);
      return;
    }

    reset();
    router.replace('/(tabs)/home');
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapFill}>
        <OsmMap
          variant="plain"
          height="100%"
          latitude={pickup?.latitude}
          longitude={pickup?.longitude}
          zoom={16}
          // Full-screen with only a sheet below it — no scroller to compete with.
          interactive
        />
        <View style={styles.beaconWrap} pointerEvents="none">
          <PulseBeacon size={80}>
            <Ionicons name="search" size={32} color={colors.white} />
          </PulseBeacon>
        </View>
      </View>

      <View style={styles.sheet}>
        <Text style={styles.title}>Finding a driver</Text>
        <Text style={styles.subtitle}>
          {dropoff ? `Looking for a tricycle to ${dropoff.label}` : 'Looking for a tricycle nearby'}
        </Text>
        <View style={styles.cancelButton}>
          <Button
            label="Cancel request"
            variant="outline"
            tone="neutral"
            fullWidth
            loading={isCancelling}
            disabled={isCancelling}
            onPress={handleCancel}
          />
        </View>
        {cancelError && <Text style={styles.cancelError}>{cancelError}</Text>}
      </View>
    </View>
  );
}
```

Note what changed from the original: the `pickRandomDriver`/`randomBetween`/`wait` imports and the fake-match `useEffect` are gone; `setDriver` is no longer used on this screen (it stays on `useBookingStore` for `driver-found.tsx` per item 5); the mount effect now guards on a missing `rideRequestId`, subscribes for real, and reacts to `assigned`/`cancelled`; `handleCancel` is now `async` and calls the real service.

- [ ] **Step 3: Delete the now-dead fake driver mock**

```bash
git rm apps/passenger/src/mocks/drivers.ts
```

- [ ] **Step 4: Fix the stale claim in DESIGN.md**

Read `apps/passenger/DESIGN.md` around line 132 — it currently reads:

> Flows still run end to end so the UI stays walkable for design review: login accepts what you type, and `pickRandomDriver()` returns an unpopulated record so the ride sequence reaches Payment and Rate driver. Rides completed in a session are appended to history, so the list fills as you use the app.

Change it to:

> Flows still run end to end so the UI stays walkable for design review: login accepts what you type, and a requested ride now genuinely waits on a real `ride_requests` row rather than a simulated match — the ride sequence past "Finding a driver" isn't reachable in dev until a driver-side flow exists to assign one. Rides completed in a session are appended to history, so the list fills as you use the app.

- [ ] **Step 5: Typecheck**

Run: `cd apps/passenger && npx tsc --noEmit`
Expected: no new errors, no leftover references to `pickRandomDriver` or `src/mocks/drivers`.

- [ ] **Step 6: Manual verification against the live Supabase project**

1. Repeat Task 5's manual flow: request a ride, confirm the app now sits on "Finding a driver" indefinitely (no fake driver appears after a few seconds).
2. Tap "Cancel request": confirm the row's `status` flips to `'cancelled'` in the DB (Supabase Studio or MCP), `cancelled_at` is set, `cancel_reason = 'Cancelled by passenger'`, and the app returns to Home.
3. Request a second ride. While it sits on "Finding a driver", manually run against the live project: `update public.ride_requests set status = 'assigned' where id = '<that row's id>';`. Confirm the app navigates to `driver-found.tsx` within a few seconds (it will show "No driver matched" — expected, since driver-side data isn't wired until item 5).
4. Request a third ride, manually set that row's `status` to `'cancelled'` via SQL (simulating an external cancel), confirm the app returns to Home on its own.

- [ ] **Step 7: Commit**

```bash
git add apps/passenger/app/booking/finding-driver.tsx apps/passenger/src/styles/booking/finding-driver.styles.ts apps/passenger/DESIGN.md
git commit -m "feat(passenger): make finding-driver.tsx wait on a real ride_requests subscription"
```

---

## Post-plan note

After Task 6, `docs/PASSENGER_TODO.MD` row 4 can be marked done (✅) the same way rows 0–3 and 11 already are, with a short note of what was verified live — following the existing style in that file. This isn't a separate task here since it's a one-line doc edit best done once all six tasks are confirmed merged, not mid-plan.
