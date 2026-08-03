# Driver App: Real Ride Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the driver app's fake, randomly-generated ride requests with a real Supabase-backed request board: drivers see actual pending `ride_requests` via Realtime, and accepting one performs a real database write.

**Architecture:** Two new functions in `packages/services/src/booking/index.ts` (`acceptRideRequest`, `subscribeToPendingRideRequests`) do the Supabase work; `apps/driver/src/store/useRequestsStore.ts` is rewritten to call them instead of running a `setTimeout` loop that invents requests; the three screens that touch the store (`dashboard.tsx`, `requests.tsx`, `logout.tsx`) are updated to the new (now-async) method names.

**Tech Stack:** TypeScript, Zustand, `@supabase/supabase-js` Realtime (`postgres_changes`), Node's built-in test runner (`node --test`).

## Global Constraints

- Naive query only — no bearing/detour/cluster-authorization filtering. That heuristic depends on the not-yet-built `match-ride-request` Edge Function (`docs/DRIVER_TODO.MD` open item #1) and is explicitly out of scope.
- `useTripStore`, the active-trip screen, trip completion, cash confirmation, `useDriverStore.isAvailable` persistence, earnings, and history stay exactly as they are today (local mock state) — do not touch them.
- Value imports of TypeScript files must use an explicit `.ts` extension (Node's ESM loader under `node --test` has no extension inference) — this repo's existing files already follow this (e.g. `useRequestsStore.ts` imports `'../mocks/delay.ts'`, not `'../mocks/delay'`).
- Import `@trisakay/services` functions via their direct subpath file (e.g. `'@trisakay/services/src/booking/index.ts'`), **not** the package barrel (`'@trisakay/services'`). The barrel's `src/index.ts` re-exports every subfolder without a file extension (`export * from './supabase'`), which is a directory import — Node's strict ESM resolver rejects it under `node --test` (confirmed by hand: `Error [ERR_UNSUPPORTED_DIR_IMPORT]`). Fixing the barrel itself turned out to be a much bigger, unrelated change (every subfolder's own `index.ts` has the same extensionless-export problem one level deeper), so it's left alone; new code here routes around it via subpath imports instead.
- Full spec: `docs/superpowers/specs/2026-08-04-driver-real-ride-requests-design.md`.

---

### Task 1: `acceptRideRequest` service function

**Files:**
- Modify: `packages/services/src/booking/index.ts` (append after `cancelRideRequest`, before `subscribeToRideRequestStatus`)
- Test: `packages/services/tests/booking.test.ts` (append)

**Interfaces:**
- Consumes: `getSupabaseClient` (already imported at the top of `booking/index.ts`).
- Produces: `export interface AcceptRideRequestResult { error: string | null }` and `export async function acceptRideRequest(driverId: string, rideRequestId: string): Promise<AcceptRideRequestResult>` — used by Task 3.

- [ ] **Step 1: Write the failing tests**

Append to `packages/services/tests/booking.test.ts` (add `acceptRideRequest` to the existing import line at the top of the file):

```ts
import { createRideRequest, cancelRideRequest, subscribeToRideRequestStatus, acceptRideRequest } from '../src/booking/index.ts';
```

Then append these five test blocks at the end of the file:

```ts
test('acceptRideRequest reuses an existing active trip and assigns the ride request', async () => {
  const capturedTripLookup: { column: string; value: unknown }[] = [];
  let capturedUpdate: any = null;
  const capturedUpdateFilters: { column: string; value: unknown }[] = [];

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: (table) => {
        if (table === 'trips') {
          return {
            select: () => ({
              eq: (column: string, value: unknown) => {
                capturedTripLookup.push({ column, value });
                return {
                  eq: (column2: string, value2: unknown) => {
                    capturedTripLookup.push({ column: column2, value: value2 });
                    return {
                      maybeSingle: async () => ({ data: { id: 'trip1' }, error: null }),
                    };
                  },
                };
              },
            }),
          };
        }
        if (table === 'ride_requests') {
          return {
            update: (row: unknown) => {
              capturedUpdate = row;
              return {
                eq: (column: string, value: unknown) => {
                  capturedUpdateFilters.push({ column, value });
                  return {
                    eq: (column2: string, value2: unknown) => {
                      capturedUpdateFilters.push({ column: column2, value: value2 });
                      return {
                        select: () => ({
                          maybeSingle: async () => ({ data: { id: 'rr1' }, error: null }),
                        }),
                      };
                    },
                  };
                },
              };
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    })
  );

  const { error } = await acceptRideRequest('driver1', 'rr1');

  assert.equal(error, null);
  assert.deepEqual(capturedTripLookup, [
    { column: 'driver_id', value: 'driver1' },
    { column: 'status', value: 'active' },
  ]);
  assert.equal(capturedUpdate.trip_id, 'trip1');
  assert.equal(capturedUpdate.status, 'assigned');
  assert.ok(capturedUpdate.assigned_at);
  assert.deepEqual(capturedUpdateFilters, [
    { column: 'id', value: 'rr1' },
    { column: 'status', value: 'pending' },
  ]);
});

test("acceptRideRequest creates a trip from the driver's active tricycle when none exists", async () => {
  const capturedTricycleLookup: { column: string; value: unknown }[] = [];
  let capturedTripInsert: any = null;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: (table) => {
        if (table === 'trips') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
            insert: (row: unknown) => {
              capturedTripInsert = row;
              return {
                select: () => ({
                  single: async () => ({ data: { id: 'trip2' }, error: null }),
                }),
              };
            },
          };
        }
        if (table === 'tricycles') {
          return {
            select: () => ({
              eq: (column: string, value: unknown) => {
                capturedTricycleLookup.push({ column, value });
                return {
                  eq: (column2: string, value2: unknown) => {
                    capturedTricycleLookup.push({ column: column2, value: value2 });
                    return {
                      eq: (column3: string, value3: unknown) => {
                        capturedTricycleLookup.push({ column: column3, value: value3 });
                        return {
                          maybeSingle: async () => ({ data: { id: 'tri1', seat_capacity: 3 }, error: null }),
                        };
                      },
                    };
                  },
                };
              },
            }),
          };
        }
        if (table === 'ride_requests') {
          return {
            update: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    maybeSingle: async () => ({ data: { id: 'rr1' }, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    })
  );

  const { error } = await acceptRideRequest('driver1', 'rr1');

  assert.equal(error, null);
  assert.deepEqual(capturedTricycleLookup, [
    { column: 'driver_id', value: 'driver1' },
    { column: 'is_active', value: true },
    { column: 'verification_status', value: 'approved' },
  ]);
  assert.equal(capturedTripInsert.driver_id, 'driver1');
  assert.equal(capturedTripInsert.tricycle_id, 'tri1');
  assert.equal(capturedTripInsert.max_seats, 3);
  assert.equal(capturedTripInsert.status, 'active');
});

test('acceptRideRequest reports a clear error when the driver has no active tricycle', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: (table) => {
        if (table === 'trips') {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
          };
        }
        if (table === 'tricycles') {
          return {
            select: () => ({
              eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    })
  );

  const { error } = await acceptRideRequest('driver1', 'rr1');
  assert.equal(error, 'No active tricycle assigned yet — finish vehicle verification first.');
});

test('acceptRideRequest reports a clear error when another driver already accepted the request', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: (table) => {
        if (table === 'trips') {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'trip1' }, error: null }) }) }) }),
          };
        }
        if (table === 'ride_requests') {
          return {
            update: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    })
  );

  const { error } = await acceptRideRequest('driver1', 'rr1');
  assert.equal(error, 'This ride was just accepted by another driver.');
});

test('acceptRideRequest surfaces a Postgres error from the assignment update', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: (table) => {
        if (table === 'trips') {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'trip1' }, error: null }) }) }) }),
          };
        }
        if (table === 'ride_requests') {
          return {
            update: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'network error' } }) }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    })
  );

  const { error } = await acceptRideRequest('driver1', 'rr1');
  assert.equal(error, 'network error');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/services && npm test`
Expected: FAIL — `acceptRideRequest` is not exported from `../src/booking/index.ts`.

- [ ] **Step 3: Implement `acceptRideRequest`**

Append to `packages/services/src/booking/index.ts`, after `cancelRideRequest` and before `export type RideRequestStatusUpdate`:

```ts
export interface AcceptRideRequestResult {
  error: string | null;
}

/**
 * Finds (or creates) the driver's active trip, then assigns the ride request
 * to it. The final update is guarded by `status = 'pending'` so a driver who
 * loses a race against another driver gets a clear error instead of silently
 * overwriting someone else's assignment.
 */
export async function acceptRideRequest(driverId: string, rideRequestId: string): Promise<AcceptRideRequestResult> {
  const client = getSupabaseClient();

  const { data: existingTrip, error: tripLookupError } = await client
    .from('trips')
    .select('id')
    .eq('driver_id', driverId)
    .eq('status', 'active')
    .maybeSingle();

  if (tripLookupError) return { error: tripLookupError.message };

  let tripId: string | undefined = existingTrip?.id;

  if (!tripId) {
    const { data: tricycle, error: tricycleError } = await client
      .from('tricycles')
      .select('id, seat_capacity')
      .eq('driver_id', driverId)
      .eq('is_active', true)
      .eq('verification_status', 'approved')
      .maybeSingle();

    if (tricycleError) return { error: tricycleError.message };
    if (!tricycle) return { error: 'No active tricycle assigned yet — finish vehicle verification first.' };

    const { data: newTrip, error: createTripError } = await client
      .from('trips')
      .insert({
        driver_id: driverId,
        tricycle_id: tricycle.id,
        max_seats: tricycle.seat_capacity,
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (createTripError) return { error: createTripError.message };
    tripId = newTrip.id;
  }

  const { data: assigned, error: assignError } = await client
    .from('ride_requests')
    .update({
      trip_id: tripId,
      status: 'assigned',
      assigned_at: new Date().toISOString(),
    })
    .eq('id', rideRequestId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (assignError) return { error: assignError.message };
  if (!assigned) return { error: 'This ride was just accepted by another driver.' };

  return { error: null };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/services && npm test`
Expected: PASS — all 5 new tests plus the existing suite green.

- [ ] **Step 5: Commit**

```bash
git add packages/services/src/booking/index.ts packages/services/tests/booking.test.ts
git commit -m "services: add acceptRideRequest for driver ride-request assignment"
```

---

### Task 2: `subscribeToPendingRideRequests` service function

**Files:**
- Modify: `packages/services/src/booking/index.ts` (append after `subscribeToRideRequestStatus`, at the end of the file)
- Test: `packages/services/tests/booking.test.ts` (append)

**Interfaces:**
- Consumes: `getSupabaseClient`, `RideRequestRow` (both already defined in `booking/index.ts`).
- Produces: `export function subscribeToPendingRideRequests(onData: (rows: RideRequestRow[]) => void, onError?: (message: string) => void): () => void` — used by Task 3.

- [ ] **Step 1: Write the failing tests**

Add `subscribeToPendingRideRequests` to the same import line updated in Task 1:

```ts
import { createRideRequest, cancelRideRequest, subscribeToRideRequestStatus, acceptRideRequest, subscribeToPendingRideRequests } from '../src/booking/index.ts';
```

Append these three test blocks at the end of `packages/services/tests/booking.test.ts`:

```ts
test('subscribeToPendingRideRequests refetches the pending list on SUBSCRIBED and on every change event', async () => {
  let capturedChannelName: string | null = null;
  let capturedOnArgs: any = null;
  let capturedChangeHandler: (() => void) | null = null;
  let capturedStatusCallback: ((status: string) => void) | null = null;
  let capturedOrderArgs: [string, unknown] | null = null;
  let call = 0;

  const fakeChannel = {
    on: (event: string, filterArgs: unknown, handler: () => void) => {
      assert.equal(event, 'postgres_changes');
      capturedOnArgs = filterArgs;
      capturedChangeHandler = handler;
      return fakeChannel;
    },
    subscribe: (statusCallback?: (status: string) => void) => {
      capturedStatusCallback = statusCallback ?? null;
      return fakeChannel;
    },
  };

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      channel: (name: string) => {
        capturedChannelName = name;
        return fakeChannel;
      },
      removeChannel: () => {},
      from: (table: string) => {
        assert.equal(table, 'ride_requests');
        return {
          select: (columns: string) => {
            assert.equal(columns, '*');
            return {
              eq: (column: string, value: unknown) => {
                assert.equal(column, 'status');
                assert.equal(value, 'pending');
                return {
                  order: async (orderColumn: string, opts: unknown) => {
                    capturedOrderArgs = [orderColumn, opts];
                    call += 1;
                    return { data: [{ id: `rr${call}` }], error: null };
                  },
                };
              },
            };
          },
        };
      },
    })
  );

  const received: unknown[] = [];
  const unsubscribe = subscribeToPendingRideRequests((rows) => received.push(rows));

  assert.equal(capturedChannelName, 'pending_ride_requests');
  assert.equal(capturedOnArgs.event, '*');
  assert.equal(capturedOnArgs.schema, 'public');
  assert.equal(capturedOnArgs.table, 'ride_requests');
  assert.ok(capturedStatusCallback);

  capturedStatusCallback!('SUBSCRIBED');
  await Promise.resolve();
  await Promise.resolve();

  capturedChangeHandler!();
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(capturedOrderArgs, ['requested_at', { ascending: true }]);
  assert.deepEqual(received, [[{ id: 'rr1' }], [{ id: 'rr2' }]]);

  unsubscribe();
});

test('subscribeToPendingRideRequests forwards channel errors', async () => {
  let capturedStatusCallback: ((status: string) => void) | null = null;
  const fakeChannel = {
    on: () => fakeChannel,
    subscribe: (statusCallback?: (status: string) => void) => {
      capturedStatusCallback = statusCallback ?? null;
      return fakeChannel;
    },
  };

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      channel: () => fakeChannel,
      removeChannel: () => {},
      from: () => ({
        select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }),
      }),
    })
  );

  const errors: string[] = [];
  subscribeToPendingRideRequests(
    () => {},
    (message) => errors.push(message),
  );

  capturedStatusCallback!('CHANNEL_ERROR');
  capturedStatusCallback!('TIMED_OUT');

  assert.deepEqual(errors, [
    'Lost connection while listening for ride requests. Please check your connection.',
    'Lost connection while listening for ride requests. Please check your connection.',
  ]);
});

test('subscribeToPendingRideRequests unsubscribe removes the channel', async () => {
  const fakeChannel = {
    on: () => fakeChannel,
    subscribe: () => fakeChannel,
  };
  let removedChannel: unknown = null;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      channel: () => fakeChannel,
      removeChannel: (channel: unknown) => {
        removedChannel = channel;
      },
      from: () => ({
        select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }),
      }),
    })
  );

  const unsubscribe = subscribeToPendingRideRequests(() => {});
  unsubscribe();

  assert.equal(removedChannel, fakeChannel);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/services && npm test`
Expected: FAIL — `subscribeToPendingRideRequests` is not exported.

- [ ] **Step 3: Implement `subscribeToPendingRideRequests`**

Append to the very end of `packages/services/src/booking/index.ts`:

```ts
/**
 * Naive request-board feed: every pending ride request, no bearing/detour/
 * cluster filtering — that heuristic lives in the not-yet-built
 * `match-ride-request` Edge Function (docs/DRIVER_TODO.MD open item #1).
 *
 * Refetches the full pending list on every change event instead of patching
 * from the payload, since RLS can silently drop a row from this driver's view
 * mid-stream (e.g. once another driver claims it) — the same category of gap
 * `subscribeToRideRequestStatus` above works around with its post-SUBSCRIBED
 * reconcile query.
 */
export function subscribeToPendingRideRequests(
  onData: (rows: RideRequestRow[]) => void,
  onError?: (message: string) => void,
): () => void {
  const client = getSupabaseClient();

  async function refetch() {
    const { data } = await client
      .from('ride_requests')
      .select('*')
      .eq('status', 'pending')
      .order('requested_at', { ascending: true });
    onData(data ?? []);
  }

  const channel = client
    .channel('pending_ride_requests')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_requests' }, () => {
      void refetch();
    })
    .subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        void refetch();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError?.('Lost connection while listening for ride requests. Please check your connection.');
      }
    });

  return () => {
    client.removeChannel(channel);
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/services && npm test`
Expected: PASS — all new tests plus the full existing suite green.

- [ ] **Step 5: Commit**

```bash
git add packages/services/src/booking/index.ts packages/services/tests/booking.test.ts
git commit -m "services: add subscribeToPendingRideRequests for the driver request board"
```

---

### Task 3: Rewrite `useRequestsStore`

**Files:**
- Modify: `apps/driver/src/store/useRequestsStore.ts` (full rewrite)
- Modify: `apps/driver/src/types/request.ts:7` (drop stale comment)
- Test: `apps/driver/tests/requestsStore.test.js` (full rewrite)

**Interfaces:**
- Consumes: `acceptRideRequest`, `subscribeToPendingRideRequests`, `RideRequestRow` from Tasks 1–2 (imported via the direct subpath `'@trisakay/services/src/booking/index.ts'` — see Global Constraints), `__setSupabaseClientForTests` from `'@trisakay/services/src/supabase/client.ts'` (test only).
- Produces:
  ```ts
  interface RequestsState {
    pending: PendingRequest[];
    error: string | null;
    subscribe: () => void;
    unsubscribe: () => void;
    accept: (id: string, driverId: string) => Promise<PendingRequest | undefined>;
    decline: (id: string) => void;
  }
  export const useRequestsStore: UseBoundStore<StoreApi<RequestsState>>;
  ```
  — used by Task 4 (`dashboard.tsx`) and Task 5 (`requests.tsx`) and Task 6 (`logout.tsx`).

- [ ] **Step 1: Update the stale comment in the shared type**

In `apps/driver/src/types/request.ts`, remove the outdated comment (the field is no longer simulated) so the file reads:

```ts
export type PaymentMethod = 'cash' | 'gcash';

export interface PendingRequest {
  id: string;
  seats: number;
  paymentMethod: PaymentMethod;
  pickupLabel: string | null;
  dropoffLabel: string | null;
  fare: number | null;
  createdAt: string;
}
```

- [ ] **Step 2: Write the failing test file**

Replace the entire contents of `apps/driver/tests/requestsStore.test.js` with:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

function makeChannel() {
  let changeHandler = null;
  let statusCallback = null;
  const channel = {
    on: (_event, _filterArgs, handler) => {
      changeHandler = handler;
      return channel;
    },
    subscribe: (cb) => {
      statusCallback = cb ?? null;
      return channel;
    },
  };
  return {
    channel,
    fireSubscribed: () => statusCallback && statusCallback('SUBSCRIBED'),
    fireChange: () => changeHandler && changeHandler(),
  };
}

test('subscribe() populates pending from the reconcile fetch and maps fields correctly', async () => {
  const { useRequestsStore } = await import('../src/store/useRequestsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  const { channel, fireSubscribed } = makeChannel();
  __setSupabaseClientForTests({
    channel: () => channel,
    removeChannel: () => {},
    from: () => ({
      select: () => ({
        eq: () => ({
          order: async () => ({
            data: [
              {
                id: 'rr1',
                seats_requested: 2,
                preferred_method: 'gcash',
                pickup_label: 'Purok 3',
                dest_label: 'City Hall',
                estimated_fare: 25,
                requested_at: '2026-08-04T00:00:00.000Z',
              },
            ],
            error: null,
          }),
        }),
      }),
    }),
  });

  useRequestsStore.setState({ pending: [], error: null });
  useRequestsStore.getState().subscribe();
  fireSubscribed();
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(useRequestsStore.getState().pending, [
    {
      id: 'rr1',
      seats: 2,
      paymentMethod: 'gcash',
      pickupLabel: 'Purok 3',
      dropoffLabel: 'City Hall',
      fare: 25,
      createdAt: '2026-08-04T00:00:00.000Z',
    },
  ]);

  useRequestsStore.getState().unsubscribe();
});

test('decline(id) removes the request locally and it does not reappear on the next refetch', async () => {
  const { useRequestsStore } = await import('../src/store/useRequestsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  const { channel, fireSubscribed, fireChange } = makeChannel();
  const rows = [
    { id: 'rr1', seats_requested: 1, preferred_method: 'cash', pickup_label: null, dest_label: null, estimated_fare: null, requested_at: 'now' },
    { id: 'rr2', seats_requested: 1, preferred_method: 'cash', pickup_label: null, dest_label: null, estimated_fare: null, requested_at: 'now' },
  ];

  __setSupabaseClientForTests({
    channel: () => channel,
    removeChannel: () => {},
    from: () => ({
      select: () => ({ eq: () => ({ order: async () => ({ data: rows, error: null }) }) }),
    }),
  });

  useRequestsStore.setState({ pending: [], error: null });
  useRequestsStore.getState().subscribe();
  fireSubscribed();
  await Promise.resolve();
  await Promise.resolve();

  useRequestsStore.getState().decline('rr1');
  assert.deepEqual(useRequestsStore.getState().pending.map((item) => item.id), ['rr2']);

  fireChange();
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(useRequestsStore.getState().pending.map((item) => item.id), ['rr2']);

  useRequestsStore.getState().unsubscribe();
});

test('accept(id, driverId) removes the accepted request and resolves it on success', async () => {
  const { useRequestsStore } = await import('../src/store/useRequestsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    channel: () => { throw new Error('channel not needed for this test'); },
    removeChannel: () => {},
    from: (table) => {
      if (table === 'trips') {
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'trip1' }, error: null }) }) }) }) };
      }
      if (table === 'ride_requests') {
        return {
          update: () => ({
            eq: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: { id: 'rr1' }, error: null }) }) }) }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  });

  useRequestsStore.setState({
    pending: [{ id: 'rr1', seats: 1, paymentMethod: 'cash', pickupLabel: null, dropoffLabel: null, fare: null, createdAt: 'now' }],
    error: null,
  });

  const accepted = await useRequestsStore.getState().accept('rr1', 'driver1');

  assert.equal(accepted.id, 'rr1');
  assert.equal(useRequestsStore.getState().pending.length, 0);
  assert.equal(useRequestsStore.getState().error, null);
});

test('accept(id, driverId) sets error and leaves pending untouched when the service reports a failure', async () => {
  const { useRequestsStore } = await import('../src/store/useRequestsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    channel: () => { throw new Error('channel not needed for this test'); },
    removeChannel: () => {},
    from: (table) => {
      if (table === 'trips') {
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'trip1' }, error: null }) }) }) }) };
      }
      if (table === 'ride_requests') {
        return {
          update: () => ({
            eq: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  });

  useRequestsStore.setState({
    pending: [{ id: 'rr1', seats: 1, paymentMethod: 'cash', pickupLabel: null, dropoffLabel: null, fare: null, createdAt: 'now' }],
    error: null,
  });

  const accepted = await useRequestsStore.getState().accept('rr1', 'driver1');

  assert.equal(accepted, undefined);
  assert.equal(useRequestsStore.getState().pending.length, 1);
  assert.equal(useRequestsStore.getState().error, 'This ride was just accepted by another driver.');
});

test('unsubscribe() clears pending and tears down the channel', async () => {
  const { useRequestsStore } = await import('../src/store/useRequestsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  const { channel, fireSubscribed } = makeChannel();
  let removedChannel = null;

  __setSupabaseClientForTests({
    channel: () => channel,
    removeChannel: (ch) => {
      removedChannel = ch;
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: async () => ({
            data: [{ id: 'rr1', seats_requested: 1, preferred_method: 'cash', pickup_label: null, dest_label: null, estimated_fare: null, requested_at: 'now' }],
            error: null,
          }),
        }),
      }),
    }),
  });

  useRequestsStore.setState({ pending: [], error: null });
  useRequestsStore.getState().subscribe();
  fireSubscribed();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(useRequestsStore.getState().pending.length, 1);

  useRequestsStore.getState().unsubscribe();

  assert.equal(useRequestsStore.getState().pending.length, 0);
  assert.equal(removedChannel, channel);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd apps/driver && npm test`
Expected: FAIL — `useRequestsStore.getState().subscribe` is not a function (the store still has `startSimulatingArrivals`/`stopSimulatingArrivals`).

- [ ] **Step 4: Rewrite the store**

Replace the entire contents of `apps/driver/src/store/useRequestsStore.ts` with:

```ts
import { create } from 'zustand';
import { acceptRideRequest, subscribeToPendingRideRequests } from '@trisakay/services/src/booking/index.ts';
import type { RideRequestRow } from '@trisakay/services/src/booking/index.ts';
import type { PendingRequest } from '../types/request.ts';

interface RequestsState {
  pending: PendingRequest[];
  error: string | null;
  subscribe: () => void;
  unsubscribe: () => void;
  accept: (id: string, driverId: string) => Promise<PendingRequest | undefined>;
  decline: (id: string) => void;
}

function toPendingRequest(row: RideRequestRow): PendingRequest {
  return {
    id: row.id,
    seats: row.seats_requested,
    paymentMethod: row.preferred_method,
    pickupLabel: row.pickup_label,
    dropoffLabel: row.dest_label,
    fare: row.estimated_fare,
    createdAt: row.requested_at,
  };
}

let stopRealtime: (() => void) | null = null;
let dismissedIds = new Set<string>();

export const useRequestsStore = create<RequestsState>()((set, get) => ({
  pending: [],
  error: null,

  subscribe: () => {
    stopRealtime?.();
    dismissedIds = new Set();

    stopRealtime = subscribeToPendingRideRequests(
      (rows) => {
        set({ pending: rows.filter((row) => !dismissedIds.has(row.id)).map(toPendingRequest) });
      },
      (message) => set({ error: message }),
    );
  },

  unsubscribe: () => {
    stopRealtime?.();
    stopRealtime = null;
    dismissedIds = new Set();
    set({ pending: [], error: null });
  },

  accept: async (id, driverId) => {
    const request = get().pending.find((item) => item.id === id);
    if (!request) return undefined;

    const { error } = await acceptRideRequest(driverId, id);
    if (error) {
      set({ error });
      return undefined;
    }

    set((state) => ({ pending: state.pending.filter((item) => item.id !== id), error: null }));
    return request;
  },

  decline: (id) => {
    dismissedIds.add(id);
    set((state) => ({ pending: state.pending.filter((item) => item.id !== id) }));
  },
}));
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd apps/driver && npm test`
Expected: PASS — the 5 new `requestsStore.test.js` tests, plus the rest of the driver suite (`sample`, `driverStore`, `tripStore`) unaffected.

- [ ] **Step 6: Commit**

```bash
git add apps/driver/src/store/useRequestsStore.ts apps/driver/src/types/request.ts apps/driver/tests/requestsStore.test.js
git commit -m "driver: back useRequestsStore with real Supabase ride requests"
```

---

### Task 4: Wire `dashboard.tsx`

**Files:**
- Modify: `apps/driver/app/(tabs)/dashboard.tsx`
- Modify: `apps/driver/src/styles/tabs/dashboard.styles.ts`

**Interfaces:**
- Consumes: `useRequestsStore` shape from Task 3 (`subscribe`, `unsubscribe`, `error`, async `accept`).

- [ ] **Step 1: Add the error style**

In `apps/driver/src/styles/tabs/dashboard.styles.ts`, add one line to the `StyleSheet.create` object, after `offlineNote`:

```ts
  offlineNote: { ...typography.caption, color: colors.inkSoft },
  error: { ...typography.caption, color: colors.danger },
```

- [ ] **Step 2: Update the store selectors**

In `apps/driver/app/(tabs)/dashboard.tsx`, replace:

```ts
  const pending = useRequestsStore((state) => state.pending);
  const startSimulatingArrivals = useRequestsStore((state) => state.startSimulatingArrivals);
  const stopSimulatingArrivals = useRequestsStore((state) => state.stopSimulatingArrivals);
  const accept = useRequestsStore((state) => state.accept);
  const decline = useRequestsStore((state) => state.decline);
```

with:

```ts
  const pending = useRequestsStore((state) => state.pending);
  const requestError = useRequestsStore((state) => state.error);
  const subscribe = useRequestsStore((state) => state.subscribe);
  const unsubscribe = useRequestsStore((state) => state.unsubscribe);
  const accept = useRequestsStore((state) => state.accept);
  const decline = useRequestsStore((state) => state.decline);
```

- [ ] **Step 3: Update the toggle and accept handlers**

Replace:

```ts
  function handleToggleAvailable(next: boolean) {
    setAvailable(next);
    if (next) {
      startSimulatingArrivals();
    } else {
      stopSimulatingArrivals();
    }
  }

  function handleAccept(id: string) {
    if (useTripStore.getState().current) {
      router.push('/trip/active');
      return;
    }
    const request = accept(id);
    if (request) {
      startTrip(request);
      router.push('/trip/active');
    }
  }
```

with:

```ts
  function handleToggleAvailable(next: boolean) {
    setAvailable(next);
    if (next) {
      subscribe();
    } else {
      unsubscribe();
    }
  }

  async function handleAccept(id: string) {
    if (useTripStore.getState().current) {
      router.push('/trip/active');
      return;
    }
    if (!user) return;
    const request = await accept(id, user.id);
    if (request) {
      startTrip(request);
      router.push('/trip/active');
    }
  }
```

- [ ] **Step 4: Render the error inline**

Replace:

```tsx
        {incoming && (
          <View>
            <Text style={styles.sectionLabel}>Incoming request</Text>
            <RequestCard request={incoming} onAccept={() => handleAccept(incoming.id)} onDecline={() => decline(incoming.id)} />
          </View>
        )}
```

with:

```tsx
        {incoming && (
          <View>
            <Text style={styles.sectionLabel}>Incoming request</Text>
            <RequestCard request={incoming} onAccept={() => handleAccept(incoming.id)} onDecline={() => decline(incoming.id)} />
            {requestError && <Text style={styles.error}>{requestError}</Text>}
          </View>
        )}
```

- [ ] **Step 5: Typecheck**

Run: `cd apps/driver && npx tsc --noEmit`
Expected: no new errors referencing `dashboard.tsx` (pre-existing unrelated errors, if any, are not this task's concern — only confirm nothing new appears about `startSimulatingArrivals`, `stopSimulatingArrivals`, or `accept` argument counts).

- [ ] **Step 6: Commit**

```bash
git add "apps/driver/app/(tabs)/dashboard.tsx" apps/driver/src/styles/tabs/dashboard.styles.ts
git commit -m "driver: wire dashboard toggle and accept flow to real requests"
```

---

### Task 5: Wire `requests.tsx`

**Files:**
- Modify: `apps/driver/app/(tabs)/requests.tsx`
- Modify: `apps/driver/src/styles/tabs/requests.styles.ts`

**Interfaces:**
- Consumes: `useRequestsStore` shape from Task 3, `useAuthStore` (already exists at `apps/driver/src/store/useAuthStore.ts`, exposes `state.user: User | null` with `User.id: string`).

- [ ] **Step 1: Add the error style**

In `apps/driver/src/styles/tabs/requests.styles.ts`, add one line after `listContent`:

```ts
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  error: { ...typography.caption, color: colors.danger, paddingHorizontal: spacing.lg },
```

- [ ] **Step 2: Add the auth selector and error selector**

In `apps/driver/app/(tabs)/requests.tsx`, add the import:

```ts
import { useAuthStore } from '../../src/store/useAuthStore';
```

and inside the component, replace:

```ts
  const isAvailable = useDriverStore((state) => state.isAvailable);
  const pending = useRequestsStore((state) => state.pending);
  const accept = useRequestsStore((state) => state.accept);
  const decline = useRequestsStore((state) => state.decline);
  const startTrip = useTripStore((state) => state.startTrip);
```

with:

```ts
  const isAvailable = useDriverStore((state) => state.isAvailable);
  const user = useAuthStore((state) => state.user);
  const pending = useRequestsStore((state) => state.pending);
  const requestError = useRequestsStore((state) => state.error);
  const accept = useRequestsStore((state) => state.accept);
  const decline = useRequestsStore((state) => state.decline);
  const startTrip = useTripStore((state) => state.startTrip);
```

- [ ] **Step 3: Make the accept handler async**

Replace:

```ts
  function handleAccept(id: string) {
    if (useTripStore.getState().current) {
      router.push('/trip/active');
      return;
    }
    const request = accept(id);
    if (request) {
      startTrip(request);
      router.push('/trip/active');
    }
  }
```

with:

```ts
  async function handleAccept(id: string) {
    if (useTripStore.getState().current) {
      router.push('/trip/active');
      return;
    }
    if (!user) return;
    const request = await accept(id, user.id);
    if (request) {
      startTrip(request);
      router.push('/trip/active');
    }
  }
```

- [ ] **Step 4: Render the error inline**

Replace:

```tsx
      <View style={styles.header}>
        <Text style={styles.title}>Ride requests</Text>
        {isAvailable && <Badge label="Along route" tone="blue" />}
      </View>

      <FlatList
```

with:

```tsx
      <View style={styles.header}>
        <Text style={styles.title}>Ride requests</Text>
        {isAvailable && <Badge label="Along route" tone="blue" />}
      </View>

      {requestError && <Text style={styles.error}>{requestError}</Text>}

      <FlatList
```

- [ ] **Step 5: Typecheck**

Run: `cd apps/driver && npx tsc --noEmit`
Expected: no new errors referencing `requests.tsx`.

- [ ] **Step 6: Commit**

```bash
git add "apps/driver/app/(tabs)/requests.tsx" apps/driver/src/styles/tabs/requests.styles.ts
git commit -m "driver: wire requests screen accept flow to real requests"
```

---

### Task 6: Wire `logout.tsx`

**Files:**
- Modify: `apps/driver/app/logout.tsx`

**Interfaces:**
- Consumes: `useRequestsStore.getState().unsubscribe` from Task 3.

- [ ] **Step 1: Replace the stale method call**

In `apps/driver/app/logout.tsx`, replace:

```ts
    await logout();
    useRequestsStore.getState().stopSimulatingArrivals();
    useDriverStore.getState().setAvailable(false);
```

with:

```ts
    await logout();
    useRequestsStore.getState().unsubscribe();
    useDriverStore.getState().setAvailable(false);
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/driver && npx tsc --noEmit`
Expected: no new errors referencing `logout.tsx`.

- [ ] **Step 3: Full driver + services test suite (final check)**

Run: `cd packages/services && npm test && cd ../../apps/driver && npm test`
Expected: PASS — every test in both packages, including all tests added/changed in Tasks 1–3.

- [ ] **Step 4: Commit**

```bash
git add apps/driver/app/logout.tsx
git commit -m "driver: stop the realtime subscription instead of the old simulator on logout"
```
