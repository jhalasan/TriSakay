# Passenger Ride History + Payment History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the passenger app's fake, empty ride-history store with a real backend-fetched one, and add a real Payment History screen — both sourced from one new security-definer RPC.

**Architecture:** A new `get_passenger_trip_history` Postgres RPC (security definer, mirrors the driver app's `get_driver_trip_history`) returns each of the passenger's completed/cancelled rides joined with driver name and payment info. A new `packages/services/src/trip-history` module wraps the RPC call. `useHistoryStore` becomes an async `{ items, loading, error, load() }` store (matching the driver app's own history store shape) that both `history.tsx` and the new `payment-history.tsx` read from, filtering client-side for their own purposes. `complaints.tsx`'s existing "related trip" picker, which already reads this store, gets a `load()` call added so it doesn't regress to permanently empty.

**Tech Stack:** Expo Router (file-based routes), Zustand stores, Supabase (Postgres RPC via `supabase-js .rpc()`), `node --test` for service-layer unit tests, Supabase MCP tools (`apply_migration`, `execute_sql`, `generate_typescript_types`) for the live schema change — this project has no local migration files, schema changes are applied directly to the live project `ygdgbvxxqrkxlezpckif` and documented in `docs/SCHEMA.MD`.

## Global Constraints

- **Working directory:** all commands below are written relative to the repo root of whatever checkout/worktree you were dispatched into. Run them from there — do not `cd` to any other checkout of this repo.
- Project ref for all Supabase MCP calls: `ygdgbvxxqrkxlezpckif`.
- No local migration files exist in this repo — schema changes go live via the Supabase MCP `apply_migration` tool, then get written into `docs/SCHEMA.MD` by hand (the doc is the durable record, not a migration file).
- `packages/services/src/supabase/database.types.ts` is a generated file — after any live schema change, regenerate it via the Supabase MCP `generate_typescript_types` tool rather than hand-editing it.
- Service modules never throw across their public API — always return `{ data, error }` (or `{ error }` for write-only calls), matching every existing module (`ratings`, `discount`, `booking`).
- No component-level test harness exists for passenger screens — UI changes are verified via `npm run typecheck` plus manual code review, not new screen tests.
- Every new/changed passenger screen follows the existing `ScreenHeader` + `@trisakay/ui` primitives (`Card`, `ListRow`, `Badge`, `EmptyState`, `Spinner`) pattern — no new UI primitives.

---

### Task 1: `get_passenger_trip_history` RPC — deploy + document + regenerate types

**Files:**
- Modify (docs only, hand-written): `docs/SCHEMA.MD` (insert after the `get_trip_driver_info` block, ~line 809)
- Modify (generated, full regeneration): `packages/services/src/supabase/database.types.ts`

**Interfaces:**
- Produces: a live Postgres function `public.get_passenger_trip_history(p_limit integer default 50)` returning rows shaped `{ ride_request_id uuid, driver_name text, pickup_label text, dest_label text, status ride_status, fare numeric, payment_method payment_method, payment_status payment_status, requested_at timestamptz, completed_at timestamptz, cancelled_at timestamptz }`. Task 2 calls this by name via `.rpc('get_passenger_trip_history', { p_limit: limit })`.

- [ ] **Step 1: Apply the migration via Supabase MCP**

Call the Supabase MCP `apply_migration` tool with `project_id: "ygdgbvxxqrkxlezpckif"` and this SQL:

```sql
create or replace function public.get_passenger_trip_history(p_limit integer default 50)
returns table (
  ride_request_id uuid,
  driver_name     text,
  pickup_label    text,
  dest_label      text,
  status          ride_status,
  fare            numeric,
  payment_method  payment_method,
  payment_status  payment_status,
  requested_at    timestamptz,
  completed_at    timestamptz,
  cancelled_at    timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select
    rr.id,
    u.full_name,
    rr.pickup_label,
    rr.dest_label,
    rr.status,
    coalesce(rr.final_fare, rr.estimated_fare),
    tx.method,
    tx.status,
    rr.requested_at,
    rr.completed_at,
    rr.cancelled_at
  from public.ride_requests rr
  left join public.trips t on t.id = rr.trip_id
  left join public.users u on u.id = t.driver_id
  left join public.transactions tx on tx.ride_request_id = rr.id
  where rr.passenger_id = auth.uid()
    and rr.status in ('completed', 'cancelled')
  order by coalesce(rr.completed_at, rr.cancelled_at, rr.requested_at) desc
  limit p_limit;
end;
$$;

comment on function public.get_passenger_trip_history is
  'Passengers have no direct SELECT on other users'' users rows (see get_trip_driver_info above) — this security-definer function is the only path to a matched driver''s name for history purposes, self-authorized via passenger_id = auth.uid(). trips/users joins are LEFT JOIN (not INNER) because a ride cancelled before a driver was ever assigned has trip_id null; the transactions join is also LEFT because a cancelled-before-payment ride has no transaction row at all — payment_method/payment_status come back null in that case, which is a normal state for both consuming passenger-app screens, not an error.';
```

- [ ] **Step 2: Verify the function is live**

Call the Supabase MCP `execute_sql` tool with `project_id: "ygdgbvxxqrkxlezpckif"` and:

```sql
select proname from pg_proc where proname = 'get_passenger_trip_history';
```

Expected: one row, `get_passenger_trip_history`.

- [ ] **Step 3: Document the function in `docs/SCHEMA.MD`**

Open `docs/SCHEMA.MD`, find the `get_trip_driver_info` block (search for `-- 4.3c trip driver info`, ends at `end $$;` around line 809, immediately followed by a blank line then `-- 4.4 seat capacity enforcement`). Insert a new block between them:

```sql

-- 4.3d passenger trip history (real ride/payment history) ---------------
-- Passengers have no direct SELECT on other users' users rows (see 4.3c
-- above) — this security-definer function is the only path to a matched
-- driver's name for history purposes, self-authorized via
-- passenger_id = auth.uid(). trips/users joins are LEFT JOIN (not INNER)
-- because a ride cancelled before a driver was ever assigned has
-- trip_id null; the transactions join is also LEFT because a
-- cancelled-before-payment ride has no transaction row at all —
-- payment_method/payment_status come back null in that case, a normal
-- state for both consuming passenger-app screens, not an error.
create or replace function public.get_passenger_trip_history(p_limit integer default 50)
returns table (
  ride_request_id uuid,
  driver_name     text,
  pickup_label    text,
  dest_label      text,
  status          ride_status,
  fare            numeric,
  payment_method  payment_method,
  payment_status  payment_status,
  requested_at    timestamptz,
  completed_at    timestamptz,
  cancelled_at    timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select
    rr.id,
    u.full_name,
    rr.pickup_label,
    rr.dest_label,
    rr.status,
    coalesce(rr.final_fare, rr.estimated_fare),
    tx.method,
    tx.status,
    rr.requested_at,
    rr.completed_at,
    rr.cancelled_at
  from public.ride_requests rr
  left join public.trips t on t.id = rr.trip_id
  left join public.users u on u.id = t.driver_id
  left join public.transactions tx on tx.ride_request_id = rr.id
  where rr.passenger_id = auth.uid()
    and rr.status in ('completed', 'cancelled')
  order by coalesce(rr.completed_at, rr.cancelled_at, rr.requested_at) desc
  limit p_limit;
end $$;

```

- [ ] **Step 4: Regenerate `database.types.ts`**

Call the Supabase MCP `generate_typescript_types` tool with `project_id: "ygdgbvxxqrkxlezpckif"`, then write its full output over `packages/services/src/supabase/database.types.ts` (replace the whole file — it's a generated artifact, not hand-maintained).

- [ ] **Step 5: Confirm the new RPC's types landed**

Run: `grep -n "get_passenger_trip_history" packages/services/src/supabase/database.types.ts`
Expected: a match inside the `Functions` section, with `Args: { p_limit?: number }` and a `Returns` shape containing `driver_name`, `pickup_label`, `dest_label`, `status`, `fare`, `payment_method`, `payment_status`, `requested_at`, `completed_at`, `cancelled_at`.

- [ ] **Step 6: Commit**

```bash
git add docs/SCHEMA.MD packages/services/src/supabase/database.types.ts
git commit -m "feat(db): add get_passenger_trip_history RPC"
```

---

### Task 2: `packages/services/src/trip-history` module + tests

**Files:**
- Create: `packages/services/src/trip-history/index.ts`
- Modify: `packages/services/src/index.ts` (add barrel export)
- Test: `packages/services/tests/trip-history.test.ts`

**Interfaces:**
- Consumes: the live `get_passenger_trip_history` RPC from Task 1 (`p_limit` arg; row shape from Task 1 Step 1).
- Produces:
  ```ts
  export interface PassengerTripHistoryItem {
    rideRequestId: string;
    driverName: string | null;
    pickup: string | null;
    dropoff: string | null;
    status: 'completed' | 'cancelled';
    fare: number | null;
    paymentMethod: 'cash' | 'gcash' | null;
    paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | null;
    date: string;
  }
  export interface ListPassengerTripHistoryResult {
    data: PassengerTripHistoryItem[];
    error: string | null;
  }
  export async function listPassengerTripHistory(limit?: number): Promise<ListPassengerTripHistoryResult>
  ```
  Task 3's store consumes `listPassengerTripHistory` and maps `status: 'completed' | 'cancelled'` to `'done' | 'cancelled'` itself (matching how the driver app's `useHistoryStore.load()` does its own `'completed' → 'done'` mapping rather than the service layer doing it — keep the service's `status` field as the raw enum value, not pre-mapped).

- [ ] **Step 1: Write the failing tests**

Create `packages/services/tests/trip-history.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import { listPassengerTripHistory } from '../src/trip-history/index.ts';

test('listPassengerTripHistory maps a full RPC row and picks the right date', async () => {
  let capturedFn: string | null = null;
  let capturedArgs: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn, args) => {
        capturedFn = fn;
        capturedArgs = args;
        return {
          data: [
            {
              ride_request_id: 'rr1',
              driver_name: 'Juan Dela Cruz',
              pickup_label: 'SM City',
              dest_label: 'City Hall',
              status: 'completed',
              fare: 45,
              payment_method: 'gcash',
              payment_status: 'paid',
              requested_at: '2026-08-09T23:00:00.000Z',
              completed_at: '2026-08-10T00:00:00.000Z',
              cancelled_at: null,
            },
          ],
          error: null,
        };
      },
    })
  );

  const { data, error } = await listPassengerTripHistory(20);

  assert.equal(error, null);
  assert.equal(capturedFn, 'get_passenger_trip_history');
  assert.deepEqual(capturedArgs, { p_limit: 20 });
  assert.deepEqual(data, [
    {
      rideRequestId: 'rr1',
      driverName: 'Juan Dela Cruz',
      pickup: 'SM City',
      dropoff: 'City Hall',
      status: 'completed',
      fare: 45,
      paymentMethod: 'gcash',
      paymentStatus: 'paid',
      date: '2026-08-10T00:00:00.000Z',
    },
  ]);
});

test('listPassengerTripHistory handles a cancelled-before-assignment row with no driver/payment', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async () => ({
        data: [
          {
            ride_request_id: 'rr2',
            driver_name: null,
            pickup_label: 'Home',
            dest_label: null,
            status: 'cancelled',
            fare: null,
            payment_method: null,
            payment_status: null,
            requested_at: '2026-08-07T23:00:00.000Z',
            completed_at: null,
            cancelled_at: '2026-08-08T00:00:00.000Z',
          },
        ],
        error: null,
      }),
    })
  );

  const { data, error } = await listPassengerTripHistory();

  assert.equal(error, null);
  assert.deepEqual(data, [
    {
      rideRequestId: 'rr2',
      driverName: null,
      pickup: 'Home',
      dropoff: null,
      status: 'cancelled',
      fare: null,
      paymentMethod: null,
      paymentStatus: null,
      date: '2026-08-08T00:00:00.000Z',
    },
  ]);
});

test('listPassengerTripHistory uses the default limit of 50', async () => {
  let capturedArgs: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (_fn, args) => {
        capturedArgs = args;
        return { data: [], error: null };
      },
    })
  );

  await listPassengerTripHistory();
  assert.deepEqual(capturedArgs, { p_limit: 50 });
});

test('listPassengerTripHistory returns an empty array and the error message on RPC failure', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async () => ({ data: null, error: { message: 'connection refused' } }),
    })
  );

  const { data, error } = await listPassengerTripHistory();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/services && node --test ./tests/trip-history.test.ts`
Expected: FAIL — `Cannot find module '../src/trip-history/index.ts'`.

- [ ] **Step 3: Write the implementation**

Create `packages/services/src/trip-history/index.ts`:

```ts
import { getSupabaseClient } from '../supabase/client.ts';

export interface PassengerTripHistoryItem {
  rideRequestId: string;
  driverName: string | null;
  pickup: string | null;
  dropoff: string | null;
  status: 'completed' | 'cancelled';
  fare: number | null;
  paymentMethod: 'cash' | 'gcash' | null;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | null;
  date: string;
}

export interface ListPassengerTripHistoryResult {
  data: PassengerTripHistoryItem[];
  error: string | null;
}

/**
 * Calls the `get_passenger_trip_history` RPC (security definer — a passenger
 * has no direct RLS read on other users' `users` rows, so the driver's name
 * needs the same server-side join trick as getTripDriverInfo). The function
 * itself scopes results to `auth.uid()`'s own rides and only
 * 'completed'/'cancelled' ride requests.
 */
export async function listPassengerTripHistory(limit = 50): Promise<ListPassengerTripHistoryResult> {
  const { data, error } = await getSupabaseClient().rpc('get_passenger_trip_history', { p_limit: limit });

  if (error) return { data: [], error: error.message };

  const rows = (data ?? []).map((row) => ({
    rideRequestId: row.ride_request_id,
    driverName: row.driver_name,
    pickup: row.pickup_label,
    dropoff: row.dest_label,
    status: row.status as 'completed' | 'cancelled',
    fare: row.fare,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    date: row.completed_at ?? row.cancelled_at ?? row.requested_at,
  }));

  return { data: rows, error: null };
}
```

- [ ] **Step 4: Add the barrel export**

In `packages/services/src/index.ts`, add a new line after `export * from './storage/index.ts';`:

```ts
export * from './trip-history/index.ts';
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd packages/services && node --test ./tests/trip-history.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 6: Run the full services suite to confirm nothing else broke**

Run: `cd packages/services && npm test`
Expected: all tests pass (previous count + 4).

- [ ] **Step 7: Commit**

```bash
git add packages/services/src/trip-history packages/services/src/index.ts packages/services/tests/trip-history.test.ts
git commit -m "feat(services): add listPassengerTripHistory"
```

---

### Task 3: Rewrite `useHistoryStore` to fetch real data

**Files:**
- Modify: `apps/passenger/src/store/useHistoryStore.ts`
- Modify: `apps/passenger/src/types/ride.ts`
- Delete: `apps/passenger/src/mocks/rideHistory.ts`

**Interfaces:**
- Consumes: `listPassengerTripHistory` from Task 2 (`packages/services`, already exported via the `@trisakay/services` package alias).
- Produces:
  ```ts
  export interface RideHistoryItem {
    id: string;
    driverName: string;
    date: string;
    pickup: string;
    dropoff: string;
    fare: number;
    status: 'done' | 'cancelled';
    paymentMethod: 'cash' | 'gcash' | null;
    paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | null;
  }
  interface HistoryState {
    items: RideHistoryItem[];
    loading: boolean;
    error: string | null;
    load: () => Promise<void>;
  }
  export const useHistoryStore: /* zustand store with the above state */
  ```
  Task 4 (`history.tsx`), Task 5 (`complaints.tsx`), and Task 7 (`payment-history.tsx`) all read `items`/`loading`/`error`/`load` from this store — the old `rides`/`addRide` fields no longer exist.

- [ ] **Step 1: Update the `RideHistoryItem` type**

Replace the full contents of `apps/passenger/src/types/ride.ts`:

```ts
export interface RideHistoryItem {
  id: string;
  driverName: string;
  date: string;
  pickup: string;
  dropoff: string;
  fare: number;
  status: 'done' | 'cancelled';
  paymentMethod: 'cash' | 'gcash' | null;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | null;
}
```

(The old `PaymentMethod` import from `./booking` — a non-nullable `'cash' | 'gcash'` — no longer fits: a cancelled-before-payment ride has no transaction row, so `paymentMethod` must be nullable now.)

- [ ] **Step 2: Rewrite the store**

Replace the full contents of `apps/passenger/src/store/useHistoryStore.ts`:

```ts
import { create } from 'zustand';
import { listPassengerTripHistory } from '@trisakay/services';
import type { RideHistoryItem } from '../types/ride';

interface HistoryState {
  items: RideHistoryItem[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
}

export const useHistoryStore = create<HistoryState>()((set) => ({
  items: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });

    const { data, error } = await listPassengerTripHistory();
    if (error) {
      set({ loading: false, error });
      return;
    }

    set({
      loading: false,
      items: data.map((item) => ({
        id: item.rideRequestId,
        driverName: item.driverName ?? '',
        date: item.date,
        pickup: item.pickup ?? '',
        dropoff: item.dropoff ?? '',
        fare: item.fare ?? 0,
        status: item.status === 'completed' ? 'done' : 'cancelled',
        paymentMethod: item.paymentMethod,
        paymentStatus: item.paymentStatus,
      })),
    });
  },
}));
```

- [ ] **Step 3: Delete the dead mock**

```bash
git rm apps/passenger/src/mocks/rideHistory.ts
```

- [ ] **Step 4: Confirm no other file still imports the deleted mock**

Run: `grep -rn "mocks/rideHistory" apps/passenger`
Expected: no output. (If anything shows, it will be fixed by Task 4/5/6 below — don't stop here, just note it.)

- [ ] **Step 5: Commit**

```bash
git add apps/passenger/src/store/useHistoryStore.ts apps/passenger/src/types/ride.ts
git commit -m "feat(passenger): fetch real ride history instead of a mock seed"
```

(The `git rm` from Step 3 is already staged; it rides along in this commit.)

---

### Task 4: Wire `history.tsx` to the real store

**Files:**
- Modify: `apps/passenger/app/(tabs)/history.tsx`
- Modify: `apps/passenger/src/styles/tabs/history.styles.ts`

**Interfaces:**
- Consumes: `useHistoryStore` from Task 3 (`items`, `loading`, `error`, `load`); `usePullToRefresh` from `apps/passenger/src/hooks/usePullToRefresh.ts` (existing, unchanged: `usePullToRefresh(onRefresh: () => Promise<void>) => { refreshing: boolean, onRefresh: () => Promise<void> }`).

- [ ] **Step 1: Add loading/error styles**

In `apps/passenger/src/styles/tabs/history.styles.ts`, add two new keys inside the existing `StyleSheet.create({ ... })` object (after `fareText`):

```ts
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
```

- [ ] **Step 2: Rewrite `history.tsx`**

Replace the full contents of `apps/passenger/app/(tabs)/history.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, EmptyState, ListRow, Spinner, colors } from '@trisakay/ui';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/tabs/history.styles';

type FilterMode = 'all' | 'done' | 'cancelled';

const FILTER_LABEL: Record<FilterMode, string> = {
  all: 'Filter',
  done: 'Done',
  cancelled: 'Cancelled',
};

const NEXT_FILTER: Record<FilterMode, FilterMode> = {
  all: 'done',
  done: 'cancelled',
  cancelled: 'all',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export default function HistoryScreen() {
  const items = useHistoryStore((state) => state.items);
  const loading = useHistoryStore((state) => state.loading);
  const error = useHistoryStore((state) => state.error);
  const load = useHistoryStore((state) => state.load);
  const [filter, setFilter] = useState<FilterMode>('all');

  const { refreshing, onRefresh } = usePullToRefresh(load);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRides = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((ride) => ride.status === filter);
  }, [items, filter]);

  if (loading && items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingWrap}>
          <Spinner size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Ride history</Text>
        <Button
          label={FILTER_LABEL[filter]}
          size="sm"
          variant="outline"
          tone="neutral"
          onPress={() => setFilter((current) => NEXT_FILTER[current])}
        />
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <FlatList
        data={filteredRides}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentBluePressed} />
        }
        ListEmptyComponent={<EmptyState title="No rides yet" message="Your completed trips will show up here." />}
        renderItem={({ item }) => (
          <ListRow
            title={item.driverName || 'Driver'}
            // Route is omitted rather than shown half-empty when an endpoint is
            // unknown — "→ SM City" reads as a rendering bug, not as missing data.
            subtitle={
              item.pickup && item.dropoff
                ? `${formatDate(item.date)} · ${item.pickup} → ${item.dropoff}`
                : formatDate(item.date)
            }
            leading={<Avatar name={item.driverName} size="md" />}
            trailing={
              <View style={styles.trailingSlot}>
                <Badge
                  label={item.status === 'done' ? 'Done' : 'Cancel'}
                  tone={item.status === 'done' ? 'green' : 'danger'}
                />
                <Text style={styles.fareText}>{formatCurrency(item.fare)}</Text>
              </View>
            }
          />
        )}
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no new errors (the one pre-existing `discount.test.ts` error is unrelated — see prior sessions' notes — everything else clean).

- [ ] **Step 4: Commit**

```bash
git add apps/passenger/app/\(tabs\)/history.tsx apps/passenger/src/styles/tabs/history.styles.ts
git commit -m "feat(passenger): wire ride history to the real store"
```

---

### Task 5: Keep `complaints.tsx`'s trip picker working

**Files:**
- Modify: `apps/passenger/app/(tabs)/complaints.tsx`

**Interfaces:**
- Consumes: `useHistoryStore` from Task 3 (`items`, `load`).

- [ ] **Step 1: Update the store usage**

In `apps/passenger/app/(tabs)/complaints.tsx`:

1. Add `import { useEffect } from 'react';` to the existing `react` import (currently `import { useState } from 'react';` → `import { useEffect, useState } from 'react';`).
2. Replace:
   ```ts
   const rides = useHistoryStore((state) => state.rides);
   ```
   with:
   ```ts
   const rides = useHistoryStore((state) => state.items);
   const loadHistory = useHistoryStore((state) => state.load);

   useEffect(() => {
     void loadHistory();
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);
   ```

Everything else in the file (the `rides.find`, `rides.length`, `rides.map` calls) stays exactly as-is — only the source of `rides` changes, not its shape (`RideHistoryItem[]`, still has `id`/`driverName`/`pickup`/`dropoff`).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/passenger/app/\(tabs\)/complaints.tsx
git commit -m "fix(passenger): keep complaints' trip picker populated with real history"
```

---

### Task 6: Remove the dead `addRide` call from `payment.tsx`

**Files:**
- Modify: `apps/passenger/app/booking/payment.tsx`

**Interfaces:**
- Consumes: nothing new. Removes the `useHistoryStore` dependency entirely from this file.

- [ ] **Step 1: Remove the store import and unused reads**

Delete this line:
```ts
import { useHistoryStore } from '../../src/store/useHistoryStore';
```

Delete these two lines (the `driver` and `addRide` reads — `pickup` is also read only for the block being removed below, so it goes too; `dropoff` and `fare` stay, they're used elsewhere in the component for the amount card):
```ts
  const pickup = useBookingStore((state) => state.pickup);
  const driver = useBookingStore((state) => state.driver);
```
```ts
  const addRide = useHistoryStore((state) => state.addRide);
```

- [ ] **Step 2: Remove the `addRide` block from `finishSuccessfulPayment`**

Replace:
```ts
  function finishSuccessfulPayment() {
    if (settledRef.current) return;
    settledRef.current = true;

    setTripStatus('paid');

    if (driver && dropoff) {
      addRide({
        id: `r-${Date.now()}`,
        driverName: driver.name,
        date: new Date().toISOString(),
        pickup: pickup?.label ?? '',
        dropoff: dropoff.label,
        fare: fare ?? 0,
        status: 'done',
        paymentMethod,
      });
    }

    router.replace('/booking/rate-driver');
  }
```
with:
```ts
  function finishSuccessfulPayment() {
    if (settledRef.current) return;
    settledRef.current = true;

    setTripStatus('paid');
    router.replace('/booking/rate-driver');
  }
```

(`ride_requests.status` is already `'completed'` server-side by the time this screen is reachable — see item 6 in `docs/PASSENGER_TODO.MD` — so `get_passenger_trip_history` already includes this ride the next time `history.tsx`/`complaints.tsx` call `load()`. No client-side synthesis needed.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no new errors (specifically: no "declared but never used" for `pickup`/`driver`/`addRide`).

- [ ] **Step 4: Commit**

```bash
git add apps/passenger/app/booking/payment.tsx
git commit -m "refactor(passenger): drop payment.tsx's fake history append"
```

---

### Task 7: New Payment History screen

**Files:**
- Create: `apps/passenger/app/profile/payment-history.tsx`
- Create: `apps/passenger/src/styles/profile/payment-history.styles.ts`

**Interfaces:**
- Consumes: `useHistoryStore` from Task 3 (`items`, `loading`, `error`, `load`); `usePullToRefresh`; `ScreenHeader` (`apps/passenger/src/components/ScreenHeader`, props `{ title: string }`, defaults `showBack: true`).
- Produces: a new route `/profile/payment-history` (file-based routing, no manual registration needed — matches how `/profile/payment-methods` and `/profile/apply-discount` already work).

- [ ] **Step 1: Write the styles file**

Create `apps/passenger/src/styles/profile/payment-history.styles.ts`:

```ts
import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  trailingSlot: {
    alignItems: 'flex-end',
    gap: 4,
  },
  fareText: {
    ...typography.caption,
    color: colors.inkSoft,
  },
});
```

- [ ] **Step 2: Write the screen**

Create `apps/passenger/app/profile/payment-history.tsx`:

```tsx
import { useEffect, useMemo } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { Badge, EmptyState, ListRow, Spinner, colors } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/profile/payment-history.styles';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export default function PaymentHistoryScreen() {
  const items = useHistoryStore((state) => state.items);
  const loading = useHistoryStore((state) => state.loading);
  const error = useHistoryStore((state) => state.error);
  const load = useHistoryStore((state) => state.load);

  const { refreshing, onRefresh } = usePullToRefresh(load);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A pending/failed/absent payment means checkout never actually resolved —
  // it doesn't belong in a "history" list, only paid/refunded do.
  const payments = useMemo(
    () => items.filter((item) => item.paymentStatus === 'paid' || item.paymentStatus === 'refunded'),
    [items]
  );

  if (loading && items.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Payment history" />
        <View style={styles.loadingWrap}>
          <Spinner size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Payment history" />
      {error && <Text style={styles.errorText}>{error}</Text>}
      <FlatList
        data={payments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentBluePressed} />
        }
        ListEmptyComponent={<EmptyState title="No payments yet" message="Your paid trips will show up here." />}
        renderItem={({ item }) => (
          <ListRow
            title={
              item.pickup && item.dropoff ? `${item.pickup} → ${item.dropoff}` : formatDate(item.date)
            }
            subtitle={formatDate(item.date)}
            trailing={
              <View style={styles.trailingSlot}>
                <Badge
                  label={item.paymentMethod === 'gcash' ? 'GCash' : 'Cash'}
                  tone="neutral"
                />
                <Badge
                  label={item.paymentStatus === 'paid' ? 'Paid' : 'Refunded'}
                  tone={item.paymentStatus === 'paid' ? 'green' : 'blue'}
                />
                <Text style={styles.fareText}>{formatCurrency(item.fare)}</Text>
              </View>
            }
          />
        )}
      />
    </View>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/passenger/app/profile/payment-history.tsx apps/passenger/src/styles/profile/payment-history.styles.ts
git commit -m "feat(passenger): add real Payment History screen"
```

---

### Task 8: Link Payment History from `payment-methods.tsx`

**Files:**
- Modify: `apps/passenger/app/profile/payment-methods.tsx`

**Interfaces:**
- Consumes: `useRouter` from `expo-router` (new import for this file); the `/profile/payment-history` route from Task 7.

- [ ] **Step 1: Add the router import and a new nav row**

Replace the full contents of `apps/passenger/app/profile/payment-methods.tsx`:

```tsx
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Badge, Card, ListRow } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { styles } from '../../src/styles/profile/payment-methods.styles';

export default function PaymentMethodsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ScreenHeader title="Payment methods" />
      <View style={styles.content}>
        <Card>
          <ListRow
            title="GCash"
            subtitle="Linked at checkout, not saved"
            trailing={<Badge label="Available" tone="green" />}
          />
          <ListRow title="Cash" subtitle="Pay your driver directly" trailing={<Badge label="Available" tone="green" />} divider={false} />
        </Card>
        <Card>
          <ListRow
            title="Payment history"
            onPress={() => router.push('/profile/payment-history')}
            chevron
            divider={false}
          />
        </Card>
        <Text style={styles.note}>Saving a GCash account or card isn't available in this preview.</Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/passenger/app/profile/payment-methods.tsx
git commit -m "feat(passenger): link to Payment History from payment methods"
```

---

### Task 9: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck**

Run: `npm run typecheck`
Expected: only the pre-existing `packages/services/tests/discount.test.ts(11,22)` error (unrelated, present on `main` before this work), nothing else.

- [ ] **Step 2: Full services test suite**

Run: `cd packages/services && npm test`
Expected: all tests pass, including the 4 new `trip-history.test.ts` tests.

- [ ] **Step 3: Confirm no leftover references to the old store shape**

Run: `grep -rn "\.rides\b\|addRide" apps/passenger/app apps/passenger/src`
Expected: no output.

- [ ] **Step 4: Update `docs/PASSENGER_TODO.MD` and `docs/CHECKLIST.MD`**

In `docs/PASSENGER_TODO.MD`:
- Move the "Ride history" and "new Payment History screen" bullets out of the `🟡 Partial`/`❌ No code at all` sections (as applicable) into `✅ Real, backend-wired`, describing the real RPC/store/screens built here.
- Mark build-order item 8 (`| 8 | **Ride history + new Payment History screen.** ...`) as `✅ Done`, with a summary matching the style of items 1–7's done entries (what was built, files touched, what's not yet exercised on a real device).

In `docs/CHECKLIST.MD`:
- Change the two P2 lines — `Passenger: trip history → real query` and `Passenger: new Payment History screen` — from `[ ]` to `[x]`, each with a `*(done 2026-08-11)*` note summarizing what shipped, matching the style of the already-corrected driver-side lines in that file (e.g. the "Driver: trip history" line).

- [ ] **Step 5: Commit the doc updates**

```bash
git add docs/PASSENGER_TODO.MD docs/CHECKLIST.MD
git commit -m "docs: mark passenger ride/payment history done"
```
