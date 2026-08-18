# PayMongo GCash Checkout + Webhook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full GCash payment round trip — PayMongo Checkout Session creation on ride completion, and a signature-verified webhook that confirms payment server-side — so FR-9.2/FR-9.3 work end-to-end instead of the current local-state stub.

**Architecture:** Two new Supabase Edge Functions (`create-gcash-checkout`, `paymongo-webhook`) mirroring the existing `match-ride-request` function's shape (Deno, `createClient` from `npm:@supabase/supabase-js@2`, shared CORS/`json()` helpers copied inline per function since there's no shared Deno module in this repo yet). A new `packages/services/src/payments` module wraps the client-side calls. `apps/passenger/app/booking/payment.tsx` gets a real GCash path using `expo-web-browser` for the hosted checkout page and a Realtime subscription as the only source of truth for payment status.

**Tech Stack:** TypeScript, Supabase Edge Functions (Deno), `@supabase/supabase-js`, Zustand, `expo-web-browser`, Node's built-in test runner (`node:test`).

## Global Constraints

- No real money moves through the system; PayMongo stays in Test Mode permanently — never write code that could activate or assume Live Mode (FR-9.6, `docs/SCHEMA.MD` §2.7 comment).
- GCash `transactions` rows are written **only** by the `paymongo-webhook` Edge Function using the service-role key — no client-side insert/update policy exists for GCash rows by design (`docs/SCHEMA.MD` §7.6 comment). Never try to write a `paid` status from the client.
- Payment status must never be trusted from the client (FR-9.2) — the passenger app's UI only ever advances on a Realtime read of the `transactions` row, never on a checkout-page redirect or client-side timer.
- `transactions.amount` is fixed once, at checkout-session-creation time, from our own `final_fare` — the webhook only ever writes `status` and `paymongo_payload`, never `amount`.
- Existing repo pattern: Edge Functions take the caller's own `Authorization` header and use it to build a per-request Supabase client (RLS-scoped), falling back to the service-role client only where RLS has no policy for the operation (see `match-ride-request` for the auth pattern, and `docs/SCHEMA.MD` §7.6 for why `paymongo-webhook` must use service-role throughout).
- Follow the existing test convention: `packages/services/tests/*.test.ts` uses `createFakeSupabaseClient` from `packages/services/tests/fakeSupabaseClient.ts` and `__setSupabaseClientForTests`. Run with `node --test` (check `package.json` in `packages/services` for the exact script name before running).
- No unit tests are written for the Edge Functions themselves — this repo has no Deno test harness for `supabase/functions/*`, matching the existing precedent (`match-ride-request` has none either).

---

### Task 1: Lock `final_fare` at trip completion

**Files:**
- Modify: `packages/services/src/booking/index.ts` (the `completeTrip` function, currently ~line 259)
- Test: `packages/services/tests/booking.test.ts` (the three existing `completeTrip` tests, ~lines 738-824)

**Interfaces:**
- Consumes: nothing new — uses the existing `getSupabaseClient()` from `../supabase/client.ts`.
- Produces: `completeTrip(tripId, rideRequestId)` now also writes `ride_requests.final_fare`, copied from that row's own `estimated_fare` at completion time. This is what Task 5 (`create-gcash-checkout`) reads as the charge amount — later tasks can rely on `final_fare` being non-null for any ride request whose `status = 'completed'` went through this function.

This fixes a real gap found during design: `final_fare` (documented in `docs/SCHEMA.MD` as "Locked at trip completion") is currently never written anywhere, so every completed ride has `final_fare = null` — which would make the new checkout function fail on every real ride. `estimated_fare` is the only fare value that exists by trip-completion time (no separate final-fare recalculation exists anywhere in this codebase), so "lock" here means "copy `estimated_fare` into `final_fare`, unchanged."

- [ ] **Step 1: Write the failing test — completeTrip copies estimated_fare into final_fare**

Update the existing test `'completeTrip marks the trip and ride request completed'` in `packages/services/tests/booking.test.ts` (~line 738). Replace its `from` callback's `ride_requests` branch so it also handles the new `select` call, and assert `final_fare` lands in the update payload:

```typescript
test('completeTrip marks the trip and ride request completed, locking final_fare from estimated_fare', async () => {
  let capturedTripUpdate: any = null;
  let capturedTripId: unknown = null;
  let capturedRideUpdate: any = null;
  let capturedRideId: unknown = null;
  let capturedFareSelectId: unknown = null;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: (table) => {
        if (table === 'trips') {
          return {
            update: (row: unknown) => {
              capturedTripUpdate = row;
              return {
                eq: (column: string, value: unknown) => {
                  assert.equal(column, 'id');
                  capturedTripId = value;
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        }
        if (table === 'ride_requests') {
          return {
            select: (columns: string) => {
              assert.equal(columns, 'estimated_fare');
              return {
                eq: (column: string, value: unknown) => {
                  assert.equal(column, 'id');
                  capturedFareSelectId = value;
                  return {
                    maybeSingle: async () => ({ data: { estimated_fare: 42.5 }, error: null }),
                  };
                },
              };
            },
            update: (row: unknown) => {
              capturedRideUpdate = row;
              return {
                eq: (column: string, value: unknown) => {
                  assert.equal(column, 'id');
                  capturedRideId = value;
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    })
  );

  const { error } = await completeTrip('trip1', 'rr1');

  assert.equal(error, null);
  assert.equal(capturedFareSelectId, 'rr1');
  assert.equal(capturedTripUpdate.status, 'completed');
  assert.ok(capturedTripUpdate.completed_at);
  assert.equal(capturedTripId, 'trip1');
  assert.equal(capturedRideUpdate.status, 'completed');
  assert.ok(capturedRideUpdate.completed_at);
  assert.equal(capturedRideUpdate.final_fare, 42.5);
  assert.equal(capturedRideId, 'rr1');
});
```

Also update the two error-path tests so their `ride_requests`/`trips` fakes include a working `select` branch (otherwise they'll throw on the new call before reaching the code path they're testing):

```typescript
test('completeTrip surfaces a friendly error when the trip update fails', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: (table) => {
        if (table === 'ride_requests') {
          return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { estimated_fare: 42.5 }, error: null }) }) }),
          };
        }
        if (table === 'trips') {
          return { update: () => ({ eq: () => Promise.resolve({ error: { message: 'network error' } }) }) };
        }
        throw new Error(`unexpected table ${table}`);
      },
    })
  );

  const { error } = await completeTrip('trip1', 'rr1');
  assert.equal(error, "Couldn't close out the trip. Please try again.");
});

test('completeTrip surfaces a friendly error when the ride request update fails', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: (table) => {
        if (table === 'ride_requests') {
          return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { estimated_fare: 42.5 }, error: null }) }) }),
            update: () => ({ eq: () => Promise.resolve({ error: { message: 'network error' } }) }),
          };
        }
        if (table === 'trips') {
          return { update: () => ({ eq: () => Promise.resolve({ error: null }) }) };
        }
        throw new Error(`unexpected table ${table}`);
      },
    })
  );

  const { error } = await completeTrip('trip1', 'rr1');
  assert.equal(error, "Couldn't close out the trip. Please try again.");
});
```

Add one more new test for the fare-lookup failure path itself:

```typescript
test('completeTrip surfaces a friendly error when the fare lookup fails', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: (table) => {
        if (table === 'ride_requests') {
          return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'network error' } }) }) }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    })
  );

  const { error } = await completeTrip('trip1', 'rr1');
  assert.equal(error, "Couldn't close out the trip. Please try again.");
});
```

- [ ] **Step 2: Run tests to verify they fail**

From `packages/services/`, run: `node --test tests/booking.test.ts`
Expected: the new/updated `completeTrip` tests FAIL — the fare-select branch isn't called yet, and `capturedRideUpdate.final_fare` is `undefined`, not `42.5`.

- [ ] **Step 3: Implement the fare-locking change**

In `packages/services/src/booking/index.ts`, replace the existing `completeTrip` function body with:

```typescript
export async function completeTrip(tripId: string, rideRequestId: string): Promise<CompleteTripResult> {
  const client = getSupabaseClient();
  const now = new Date().toISOString();

  const { data: rideRequest, error: fareError } = await client
    .from('ride_requests')
    .select('estimated_fare')
    .eq('id', rideRequestId)
    .maybeSingle();

  if (fareError) return { error: "Couldn't close out the trip. Please try again." };

  const { error: tripError } = await client
    .from('trips')
    .update({ status: 'completed', completed_at: now })
    .eq('id', tripId);

  if (tripError) return { error: "Couldn't close out the trip. Please try again." };

  const { error: rideError } = await client
    .from('ride_requests')
    .update({ status: 'completed', completed_at: now, final_fare: rideRequest?.estimated_fare ?? null })
    .eq('id', rideRequestId);

  if (rideError) return { error: "Couldn't close out the trip. Please try again." };

  return { error: null };
}
```

- [ ] **Step 4: Run tests to verify they pass**

From `packages/services/`, run: `node --test tests/booking.test.ts`
Expected: PASS, all `completeTrip` tests green.

- [ ] **Step 5: Run the full services test suite and driver app typecheck**

Run: `node --test tests/` (from `packages/services/`) — expect all tests still passing (this touched shared code every other booking test also exercises).
Run the driver app's composite typecheck (check `apps/driver/package.json` for the exact script name, typically `tsc --noEmit` or a `typecheck` script) — expect clean, since `completeTrip`'s signature didn't change.

- [ ] **Step 6: Commit**

```bash
git add packages/services/src/booking/index.ts packages/services/tests/booking.test.ts
git commit -m "fix: lock final_fare from estimated_fare when a trip completes"
```

---

### Task 2: `packages/services/src/payments` — client-side service module

**Files:**
- Create: `packages/services/src/payments/index.ts`
- Modify: `packages/services/src/index.ts` (add barrel export)
- Test: `packages/services/tests/payments.test.ts`

**Interfaces:**
- Consumes: `getSupabaseClient()` from `../supabase/client.ts` (existing), `Database` type from `../supabase/database.types.ts` (existing).
- Produces (used by Task 4):
  - `type TransactionRow = Database['public']['Tables']['transactions']['Row']`
  - `createGcashCheckout(rideRequestId: string): Promise<{ checkoutUrl: string | null; error: string | null }>`
  - `subscribeToTransactionStatus(rideRequestId: string, onChange: (row: Pick<TransactionRow, 'id' | 'status'>) => void, onError?: (message: string) => void): () => void`

- [ ] **Step 1: Write the failing tests**

Create `packages/services/tests/payments.test.ts`:

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import { createGcashCheckout, subscribeToTransactionStatus } from '../src/payments/index.ts';

test('createGcashCheckout invokes the Edge Function with rideRequestId and returns checkoutUrl', async () => {
  let capturedName: string | null = null;
  let capturedOptions: any = null;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      functionsInvoke: async (name, options) => {
        capturedName = name;
        capturedOptions = options;
        return { data: { checkoutUrl: 'https://checkout.paymongo.com/cs_123', error: null }, error: null };
      },
    })
  );

  const { checkoutUrl, error } = await createGcashCheckout('rr1');

  assert.equal(capturedName, 'create-gcash-checkout');
  assert.deepEqual(capturedOptions, { body: { rideRequestId: 'rr1' } });
  assert.equal(error, null);
  assert.equal(checkoutUrl, 'https://checkout.paymongo.com/cs_123');
});

test('createGcashCheckout surfaces a transport-level error', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      functionsInvoke: async () => ({ data: null, error: { message: 'network error' } }),
    })
  );

  const { checkoutUrl, error } = await createGcashCheckout('rr1');

  assert.equal(checkoutUrl, null);
  assert.equal(error, 'network error');
});

test('createGcashCheckout surfaces an application-level error returned in the payload', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      functionsInvoke: async () => ({ data: { checkoutUrl: null, error: 'Already paid' }, error: null }),
    })
  );

  const { checkoutUrl, error } = await createGcashCheckout('rr1');

  assert.equal(checkoutUrl, null);
  assert.equal(error, 'Already paid');
});

test('subscribeToTransactionStatus subscribes to the right channel/filter and reconciles on SUBSCRIBED', async () => {
  let capturedChannelName: string | null = null;
  let capturedOnArgs: any = null;
  const captured: { statusCallback: ((status: string) => void) | null } = { statusCallback: null };
  const received: { id: string; status: string }[] = [];

  const fakeChannel = {
    on: (event: string, filterArgs: unknown, handler: (payload: { new: { id: string; status: string } }) => void) => {
      assert.equal(event, 'postgres_changes');
      capturedOnArgs = filterArgs;
      void handler;
      return fakeChannel;
    },
    subscribe: (statusCallback?: (status: string) => void) => {
      captured.statusCallback = statusCallback ?? null;
      return fakeChannel;
    },
  };

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      channel: (name) => {
        capturedChannelName = name;
        return fakeChannel;
      },
      removeChannel: () => {},
      from: (table) => {
        assert.equal(table, 'transactions');
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: 'txn1', status: 'pending' }, error: null }),
            }),
          }),
        };
      },
    })
  );

  subscribeToTransactionStatus('rr1', (row) => received.push(row));

  assert.equal(capturedChannelName, 'transaction_status_rr1');
  assert.equal((capturedOnArgs as any).event, 'UPDATE');
  assert.equal((capturedOnArgs as any).schema, 'public');
  assert.equal((capturedOnArgs as any).table, 'transactions');
  assert.equal((capturedOnArgs as any).filter, 'ride_request_id=eq.rr1');

  captured.statusCallback!('SUBSCRIBED');
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(received, [{ id: 'txn1', status: 'pending' }]);
});

test('subscribeToTransactionStatus forwards postgres_changes payloads', async () => {
  let capturedChangeHandler: ((payload: { new: { id: string; status: string } }) => void) | null = null;
  const received: { id: string; status: string }[] = [];

  const fakeChannel = {
    on: (_event: string, _filterArgs: unknown, handler: (payload: { new: { id: string; status: string } }) => void) => {
      capturedChangeHandler = handler;
      return fakeChannel;
    },
    subscribe: () => fakeChannel,
  };

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      channel: () => fakeChannel,
      removeChannel: () => {},
    })
  );

  subscribeToTransactionStatus('rr1', (row) => received.push(row));
  capturedChangeHandler!({ new: { id: 'txn1', status: 'paid' } });

  assert.deepEqual(received, [{ id: 'txn1', status: 'paid' }]);
});

test('subscribeToTransactionStatus forwards channel errors', async () => {
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
    })
  );

  const errors: string[] = [];
  subscribeToTransactionStatus(
    'rr1',
    () => {},
    (message) => errors.push(message),
  );

  capturedStatusCallback!('CHANNEL_ERROR');
  capturedStatusCallback!('TIMED_OUT');

  assert.deepEqual(errors, [
    'Lost connection while waiting for payment confirmation. Please check your connection.',
    'Lost connection while waiting for payment confirmation. Please check your connection.',
  ]);
});

test('subscribeToTransactionStatus unsubscribe removes the channel', async () => {
  const fakeChannel = { on: () => fakeChannel, subscribe: () => fakeChannel };
  let removedChannel: unknown = null;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      channel: () => fakeChannel,
      removeChannel: (channel: unknown) => {
        removedChannel = channel;
      },
    })
  );

  const unsubscribe = subscribeToTransactionStatus('rr1', () => {});
  unsubscribe();

  assert.equal(removedChannel, fakeChannel);
});
```

- [ ] **Step 2: Run tests to verify they fail**

From `packages/services/`, run: `node --test tests/payments.test.ts`
Expected: FAIL — `../src/payments/index.ts` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

Create `packages/services/src/payments/index.ts`:

```typescript
import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export type TransactionRow = Database['public']['Tables']['transactions']['Row'];
export type TransactionStatusUpdate = Pick<TransactionRow, 'id' | 'status'>;

export interface CreateGcashCheckoutResult {
  checkoutUrl: string | null;
  error: string | null;
}

/**
 * Invokes the create-gcash-checkout Edge Function, which upserts a pending
 * `transactions` row and creates (or reuses) a PayMongo Checkout Session.
 * Never writes to `transactions` directly from the client — there is no
 * client-facing insert policy for GCash rows by design (docs/SCHEMA.MD §7.6).
 */
export async function createGcashCheckout(rideRequestId: string): Promise<CreateGcashCheckoutResult> {
  const { data, error } = await getSupabaseClient().functions.invoke('create-gcash-checkout', {
    body: { rideRequestId },
  });

  if (error) return { checkoutUrl: null, error: error.message };

  const result = data as { checkoutUrl: string | null; error: string | null };
  return { checkoutUrl: result.checkoutUrl ?? null, error: result.error };
}

/**
 * Realtime subscription on a single transaction row, same shape as
 * subscribeToRideRequestStatus in booking/index.ts: a postgres_changes
 * subscription only forwards future events, so a status flip landing before
 * the channel finishes joining would otherwise be missed — the post-
 * SUBSCRIBED reconcile query closes that gap.
 *
 * This is the only thing that ever advances the passenger's payment UI —
 * PayMongo's own checkout-page redirect is never trusted (FR-9.2).
 */
export function subscribeToTransactionStatus(
  rideRequestId: string,
  onChange: (row: TransactionStatusUpdate) => void,
  onError?: (message: string) => void,
): () => void {
  const client = getSupabaseClient();
  const channel = client
    .channel(`transaction_status_${rideRequestId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'transactions', filter: `ride_request_id=eq.${rideRequestId}` },
      (payload: { new: TransactionStatusUpdate }) => onChange(payload.new),
    )
    .subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        client
          .from('transactions')
          .select('id, status')
          .eq('ride_request_id', rideRequestId)
          .maybeSingle()
          .then(({ data }: { data: TransactionStatusUpdate | null }) => {
            if (data) onChange(data);
          });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError?.('Lost connection while waiting for payment confirmation. Please check your connection.');
      }
    });

  return () => {
    client.removeChannel(channel);
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

From `packages/services/`, run: `node --test tests/payments.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the barrel export**

In `packages/services/src/index.ts`, add a new line (alphabetically among the existing ones, after `notifications`):

```typescript
export * from './payments/index.ts';
```

- [ ] **Step 6: Run the full services test suite**

From `packages/services/`, run: `node --test tests/`
Expected: PASS — the barrel export doesn't change runtime behavior of existing modules.

- [ ] **Step 7: Commit**

```bash
git add packages/services/src/payments/index.ts packages/services/src/index.ts packages/services/tests/payments.test.ts
git commit -m "feat: add payments service (createGcashCheckout, subscribeToTransactionStatus)"
```

---

### Task 3: Add `expo-web-browser` to the passenger app

**Files:**
- Modify: `apps/passenger/package.json` (dependency added by the install command below)

**Interfaces:**
- Produces: the `expo-web-browser` package available for import in Task 4 as `import * as WebBrowser from 'expo-web-browser'`.

- [ ] **Step 1: Install the dependency**

From `apps/passenger/`, run: `npx expo install expo-web-browser`

This is the Expo-managed install command — it resolves the version compatible with the project's installed Expo SDK (per `AGENTS.md`: this project pins to Expo v54 semantics; always prefer `expo install` over a bare `npm install` for Expo-adjacent packages so the version matches SDK 54's expectations) rather than a manual version pin.

- [ ] **Step 2: Verify the app still typechecks and starts**

Run the passenger app's composite typecheck (check `apps/passenger/package.json` for the exact script name).
Expected: clean — this step only adds a dependency, no code changes yet.

- [ ] **Step 3: Commit**

```bash
git add apps/passenger/package.json apps/passenger/package-lock.json
git commit -m "chore: add expo-web-browser to passenger app"
```

(If the repo uses a different lockfile — check for `pnpm-lock.yaml` or `yarn.lock` at the repo root first and add whichever one actually changed instead.)

---

### Task 4: Wire the GCash path in `payment.tsx`

**Files:**
- Modify: `apps/passenger/app/booking/payment.tsx`
- Modify: `apps/passenger/src/styles/booking/payment.styles.ts` (new styles for the waiting/failed states)

**Interfaces:**
- Consumes: `createGcashCheckout`, `subscribeToTransactionStatus` from `@trisakay/services` (Task 2); `useBookingStore` fields `rideRequestId`, `paymentMethod`, `setPaymentMethod`, `fare`, `driver`, `dropoff`, `pickup`, `setTripStatus` (all already exist).
- Produces: nothing consumed by later tasks — this is the leaf UI.

This task has no automated test (React Native screen, no existing test harness for `apps/passenger/app/**` screens in this repo — same precedent as the rest of `apps/passenger/app/booking/*`). Verify manually per Step 4.

- [ ] **Step 1: Replace `payment.tsx`'s GCash handling**

Replace the full contents of `apps/passenger/app/booking/payment.tsx` with:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, Text, View } from 'react-native';
import { Badge, Button, Card } from '@trisakay/ui';
import { createGcashCheckout, subscribeToTransactionStatus } from '@trisakay/services';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useBookingStore } from '../../src/store/useBookingStore';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { formatCurrency } from '../../src/utils/currency';
import { wait } from '../../src/mocks/delay';
import type { PaymentMethod } from '../../src/types/booking';
import { styles } from '../../src/styles/booking/payment.styles';

const PAYMENT_OPTIONS: { value: PaymentMethod; title: string; subtitle: string }[] = [
  { value: 'gcash', title: 'GCash Wallet', subtitle: 'Pay using your GCash balance' },
  { value: 'cash', title: 'Cash', subtitle: 'Pay the driver directly' },
];

const GCASH_WAIT_TIMEOUT_MS = 120_000;

type GcashPhase = 'idle' | 'opening' | 'waiting' | 'failed';

export default function PaymentScreen() {
  const router = useRouter();
  const pickup = useBookingStore((state) => state.pickup);
  const dropoff = useBookingStore((state) => state.dropoff);
  const fare = useBookingStore((state) => state.fare);
  const driver = useBookingStore((state) => state.driver);
  const rideRequestId = useBookingStore((state) => state.rideRequestId);
  const paymentMethod = useBookingStore((state) => state.paymentMethod);
  const setPaymentMethod = useBookingStore((state) => state.setPaymentMethod);
  const setTripStatus = useBookingStore((state) => state.setTripStatus);
  const addRide = useHistoryStore((state) => state.addRide);

  const [paying, setPaying] = useState(false);
  const [gcashPhase, setGcashPhase] = useState<GcashPhase>('idle');
  const [gcashError, setGcashError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function finishSuccessfulPayment() {
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

  async function handlePayNowCash() {
    setPaying(true);
    await wait(800);
    setPaying(false);
    finishSuccessfulPayment();
  }

  async function handlePayNowGcash() {
    if (!rideRequestId) {
      setGcashError('Missing ride details — please go back and try again.');
      setGcashPhase('failed');
      return;
    }

    setGcashPhase('opening');
    setGcashError(null);

    const { checkoutUrl, error } = await createGcashCheckout(rideRequestId);

    if (error || !checkoutUrl) {
      setGcashError(error ?? 'Could not start GCash checkout.');
      setGcashPhase('failed');
      return;
    }

    setGcashPhase('waiting');

    unsubscribeRef.current = subscribeToTransactionStatus(
      rideRequestId,
      (row) => {
        if (row.status === 'paid') {
          unsubscribeRef.current?.();
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          finishSuccessfulPayment();
        } else if (row.status === 'failed') {
          unsubscribeRef.current?.();
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setGcashError('Payment failed. You can retry or pay cash instead.');
          setGcashPhase('failed');
        }
      },
      (message) => {
        setGcashError(message);
        setGcashPhase('failed');
      },
    );

    timeoutRef.current = setTimeout(() => {
      unsubscribeRef.current?.();
      setGcashError("We couldn't confirm your payment yet. You can retry or pay cash instead.");
      setGcashPhase('failed');
    }, GCASH_WAIT_TIMEOUT_MS);

    // Never trusted for anything — the Realtime subscription above is the
    // only thing that advances the UI (FR-9.2). This just gives the
    // passenger a hosted page to actually pay on.
    await WebBrowser.openBrowserAsync(checkoutUrl);
  }

  async function handlePayNow() {
    if (paymentMethod === 'gcash') {
      await handlePayNowGcash();
    } else {
      await handlePayNowCash();
    }
  }

  function handleRetryGcash() {
    setGcashPhase('idle');
    setGcashError(null);
    void handlePayNowGcash();
  }

  function handleFallbackToCash() {
    unsubscribeRef.current?.();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setGcashPhase('idle');
    setGcashError(null);
    setPaymentMethod('cash');
  }

  const gcashBusy = gcashPhase === 'opening' || gcashPhase === 'waiting';

  return (
    <View style={styles.container}>
      <ScreenHeader title="Payment" showBack={false} />
      <View style={styles.content}>
        <Card variant="raised" style={styles.amountCard}>
          <Text style={styles.amountLabel}>Amount due</Text>
          <Text style={styles.amountValue}>{fare === null ? '—' : formatCurrency(fare)}</Text>
          {dropoff && <Text style={styles.amountNote}>Trip to {dropoff.label}</Text>}
        </Card>

        <View>
          <Text style={styles.sectionLabel}>Pay with</Text>
          {PAYMENT_OPTIONS.map((option) => {
            const selected = paymentMethod === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                disabled={gcashBusy}
                style={[styles.optionRow, selected && styles.optionRowSelected]}
                onPress={() => setPaymentMethod(option.value)}
              >
                <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                  {selected && <View style={styles.radioInner} />}
                </View>
                <View style={styles.optionTextSlot}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                </View>
                <Badge label={option.value === 'gcash' ? 'GCash' : 'Cash'} tone="neutral" />
              </Pressable>
            );
          })}
        </View>

        {gcashPhase === 'waiting' && (
          <Text style={styles.gcashStatusText}>Waiting for PayMongo to confirm your payment…</Text>
        )}
        {gcashPhase === 'failed' && gcashError && (
          <View style={styles.gcashErrorBox}>
            <Text style={styles.gcashErrorText}>{gcashError}</Text>
            <View style={styles.gcashErrorActions}>
              <Button label="Retry GCash" onPress={handleRetryGcash} />
              <Button label="Pay cash instead" variant="outline" onPress={handleFallbackToCash} />
            </View>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Button
          label={gcashPhase === 'opening' ? 'Opening PayMongo…' : 'Pay now'}
          fullWidth
          loading={paying || gcashPhase === 'opening'}
          disabled={gcashPhase === 'waiting' || gcashPhase === 'failed'}
          onPress={handlePayNow}
        />
      </View>
    </View>
  );
}
```

`Button`'s `variant` prop is `'solid' | 'outline'` (`packages/ui/src/components/Button/Button.tsx`) — `outline` is used above for the secondary action, confirmed against the actual component before writing this step.

- [ ] **Step 2: Add the new styles**

Append to `apps/passenger/src/styles/booking/payment.styles.ts`, inside the `StyleSheet.create({...})` object, after `footer`:

```typescript
  gcashStatusText: {
    ...typography.caption,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  gcashErrorBox: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.accentBlueSoft,
    gap: spacing.md,
  },
  gcashErrorText: {
    ...typography.body,
    color: colors.ink,
  },
  gcashErrorActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
```

`typography.body` is a real token (`packages/ui/src/theme/typography.ts:50`), alongside the `typography.label`/`typography.amount`/`typography.caption`/`typography.bodyStrong` this file already uses.

- [ ] **Step 3: Typecheck**

Run the passenger app's composite typecheck.
Expected: clean.

- [ ] **Step 4: Manual verification (cannot be automated — no test harness for this screen)**

This step can only be fully exercised once Tasks 5–6 are deployed (Task 7). For now:
- Confirm the screen renders with GCash selected and cash selected, no crash, in Expo Go or a simulator.
- Confirm selecting a payment method while `gcashBusy` is true is disabled (tap-test both options mid-flow once Task 7 is live).

- [ ] **Step 5: Commit**

```bash
git add apps/passenger/app/booking/payment.tsx apps/passenger/src/styles/booking/payment.styles.ts
git commit -m "feat: wire real GCash checkout flow into payment screen"
```

---

### Task 5: `create-gcash-checkout` Edge Function

**Files:**
- Create: `supabase/functions/create-gcash-checkout/index.ts`

**Interfaces:**
- Consumes: `PAYMONGO_SECRET_KEY` env var (set in Task 7); `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (Supabase-provided defaults, same as every other Edge Function).
- Produces: HTTP endpoint invoked by `createGcashCheckout` (Task 2) via `supabase.functions.invoke('create-gcash-checkout', { body: { rideRequestId } })`. Response shape: `{ checkoutUrl: string | null, error: string | null }`.

No automated test for this file (Deno runtime, no test harness in this repo — see Global Constraints). Verification is manual, in Task 7.

- [ ] **Step 1: Write the function**

Create `supabase/functions/create-gcash-checkout/index.ts`:

```typescript
// FR-9.2: on ride completion, if GCash was selected, create a PayMongo
// Checkout Session (test mode) for the locked final_fare. Returns the
// hosted checkout_url for the passenger app to open in an in-app browser.
//
// Idempotent by ride_request_id: a pending transactions row with an
// unexpired stored checkout_url is reused rather than creating a duplicate
// PayMongo session on retry (e.g. the passenger backgrounds the app and taps
// "Pay now" again).
//
// GCash transactions are written ONLY by this function and by
// paymongo-webhook, both via the service-role client — there is no
// client-facing insert/update policy for GCash rows (docs/SCHEMA.MD §7.6).

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYMONGO_API_BASE = 'https://api.paymongo.com/v1';
const CHECKOUT_SUCCESS_URL = 'https://trisakay.app/payment-complete';
const CHECKOUT_CANCEL_URL = 'https://trisakay.app/payment-cancelled';

interface PaymongoCheckoutSession {
  id: string;
  attributes: {
    checkout_url: string;
    [key: string]: unknown;
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isSessionExpired(paymongoPayload: Record<string, unknown> | null): boolean {
  if (!paymongoPayload) return true;
  const expiresAt = paymongoPayload.expires_at;
  if (typeof expiresAt !== 'number') return true;
  return Date.now() / 1000 >= expiresAt;
}

async function createPaymongoCheckoutSession(
  secretKey: string,
  amount: number,
  referenceNumber: string,
  rideRequestId: string,
): Promise<{ session: PaymongoCheckoutSession | null; errorMessage: string | null }> {
  const response = await fetch(`${PAYMONGO_API_BASE}/checkout_sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${secretKey}:`)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [
            {
              name: 'TriSakay ride fare',
              amount: Math.round(amount * 100),
              currency: 'PHP',
              quantity: 1,
            },
          ],
          payment_method_types: ['gcash'],
          success_url: CHECKOUT_SUCCESS_URL,
          cancel_url: CHECKOUT_CANCEL_URL,
          description: `TriSakay ride ${rideRequestId}`,
          reference_number: referenceNumber,
          metadata: { ride_request_id: rideRequestId },
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return { session: null, errorMessage: `PayMongo error (${response.status}): ${body}` };
  }

  const payload = await response.json();
  return { session: payload.data as PaymongoCheckoutSession, errorMessage: null };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ checkoutUrl: null, error: 'Missing Authorization header' }, 401);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ checkoutUrl: null, error: 'Not authenticated' }, 401);

    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const rideRequestId = typeof body.rideRequestId === 'string' ? body.rideRequestId : null;
    if (!rideRequestId) return json({ checkoutUrl: null, error: 'rideRequestId is required' }, 400);

    const { data: rideRequest, error: rideError } = await supabase
      .from('ride_requests')
      .select('id, passenger_id, status, final_fare')
      .eq('id', rideRequestId)
      .maybeSingle();

    if (rideError) return json({ checkoutUrl: null, error: rideError.message }, 500);
    if (!rideRequest) return json({ checkoutUrl: null, error: 'Ride request not found' }, 404);
    if (rideRequest.passenger_id !== userData.user.id) {
      return json({ checkoutUrl: null, error: 'rideRequestId must belong to the authenticated passenger' }, 403);
    }
    if (rideRequest.status !== 'completed') {
      return json({ checkoutUrl: null, error: "Ride isn't completed yet" }, 400);
    }
    if (rideRequest.final_fare == null) {
      return json({ checkoutUrl: null, error: 'Ride has no locked fare yet' }, 500);
    }

    // service-role client: no client-facing write policy exists for
    // transactions on the GCash path (docs/SCHEMA.MD §7.6).
    const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: existing, error: existingError } = await serviceClient
      .from('transactions')
      .select('id, status, paymongo_payload')
      .eq('ride_request_id', rideRequestId)
      .maybeSingle();

    if (existingError) return json({ checkoutUrl: null, error: existingError.message }, 500);

    if (existing?.status === 'paid') {
      return json({ checkoutUrl: null, error: 'Already paid' }, 400);
    }

    let transactionId: string;

    if (existing) {
      transactionId = existing.id;
      const payload = existing.paymongo_payload as Record<string, unknown> | null;
      if (!isSessionExpired(payload)) {
        return json({ checkoutUrl: (payload!.checkout_url as string) ?? null, error: null });
      }
    } else {
      const { data: inserted, error: insertError } = await serviceClient
        .from('transactions')
        .insert({
          ride_request_id: rideRequestId,
          amount: rideRequest.final_fare,
          method: 'gcash',
          status: 'pending',
        })
        .select('id')
        .single();

      if (insertError) return json({ checkoutUrl: null, error: insertError.message }, 500);
      transactionId = inserted.id;
    }

    const { session, errorMessage } = await createPaymongoCheckoutSession(
      Deno.env.get('PAYMONGO_SECRET_KEY')!,
      rideRequest.final_fare,
      transactionId,
      rideRequestId,
    );

    if (errorMessage || !session) return json({ checkoutUrl: null, error: errorMessage ?? 'PayMongo session creation failed' }, 502);

    const { error: updateError } = await serviceClient
      .from('transactions')
      .update({
        paymongo_session_id: session.id,
        paymongo_payload: {
          checkout_url: session.attributes.checkout_url,
          session,
          expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        },
      })
      .eq('id', transactionId);

    if (updateError) return json({ checkoutUrl: null, error: updateError.message }, 500);

    return json({ checkoutUrl: session.attributes.checkout_url, error: null });
  } catch (err) {
    return json({ checkoutUrl: null, error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
  }
});
```

- [ ] **Step 2: Self-review against the spec**

Re-read `docs/superpowers/specs/2026-08-07-paymongo-webhook-design.md`'s "`create-gcash-checkout` Edge Function" section line by line against the file just written. Confirm every numbered step in the spec has corresponding code (idempotent reuse, expiry check, error codes, `reference_number` = transaction id, `metadata.ride_request_id`).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/create-gcash-checkout/index.ts
git commit -m "feat: add create-gcash-checkout Edge Function"
```

---

### Task 6: `paymongo-webhook` Edge Function

**Files:**
- Create: `supabase/functions/paymongo-webhook/index.ts`

**Interfaces:**
- Consumes: `PAYMONGO_WEBHOOK_SECRET` env var (set in Task 7); `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Produces: public HTTP endpoint registered with PayMongo in Task 7. No response body contract with any client code — PayMongo only checks the HTTP status.

No automated test for this file (same reasoning as Task 5). Verification is manual, in Task 7, using PayMongo's dashboard test-send feature.

- [ ] **Step 1: Write the function**

Create `supabase/functions/paymongo-webhook/index.ts`:

```typescript
// FR-9.2: server-side, signature-verified confirmation that a PayMongo
// Checkout Session was paid. This is the ONLY place transactions.status is
// ever set to 'paid' for the GCash path — payment status is never trusted
// from the client.
//
// Signature verification note: PayMongo's own docs were inconsistent across
// pages on the exact `Paymongo-Signature` header format (a plain HMAC-SHA256
// hex digest of the raw body vs. a Stripe-style `t=...,te=...,li=...`
// structure). This handles both. BEFORE trusting this in the real flow, send
// a test event from the PayMongo dashboard (Developers -> Webhooks -> your
// endpoint -> "Send test webhook") and confirm which branch actually
// matches — see docs/superpowers/specs/2026-08-07-paymongo-webhook-design.md.

import { createClient } from 'npm:@supabase/supabase-js@2';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifySignature(rawBody: string, header: string, secret: string): Promise<boolean> {
  if (header.includes('=') && header.includes(',')) {
    const parts = Object.fromEntries(
      header.split(',').map((pair) => {
        const [key, value] = pair.split('=');
        return [key, value];
      }),
    );
    const timestamp = parts.t;
    const candidate = parts.te ?? parts.li;
    if (!timestamp || !candidate) return false;
    const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
    return timingSafeEqual(expected, candidate);
  }

  const expected = await hmacSha256Hex(secret, rawBody);
  return timingSafeEqual(expected, header);
}

Deno.serve(async (req: Request) => {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get('Paymongo-Signature');

    if (!signatureHeader) {
      console.warn('paymongo-webhook: missing Paymongo-Signature header');
      return new Response('Missing signature', { status: 401 });
    }

    const secret = Deno.env.get('PAYMONGO_WEBHOOK_SECRET')!;
    const valid = await verifySignature(rawBody, signatureHeader, secret);

    if (!valid) {
      console.warn('paymongo-webhook: signature verification failed', { signatureHeader });
      return new Response('Invalid signature', { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event?.data?.attributes?.type;
    const sessionAttributes = event?.data?.attributes?.data?.attributes;
    const referenceNumber = sessionAttributes?.reference_number;

    if (!referenceNumber) {
      console.warn('paymongo-webhook: no reference_number in payload', { eventType });
      return new Response('ok', { status: 200 });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    if (eventType === 'checkout_session.payment.paid') {
      const { data, error } = await supabase
        .from('transactions')
        .update({ status: 'paid', paymongo_payload: event })
        .eq('id', referenceNumber)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('paymongo-webhook: failed to mark transaction paid', error.message);
        return new Response('Internal error', { status: 500 });
      }
      if (!data) {
        console.log('paymongo-webhook: no pending transaction matched (already paid or unknown)', { referenceNumber });
      }
      return new Response('ok', { status: 200 });
    }

    if (eventType === 'payment.failed') {
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'failed', paymongo_payload: event })
        .eq('id', referenceNumber)
        .eq('status', 'pending');

      if (error) {
        console.error('paymongo-webhook: failed to mark transaction failed', error.message);
        return new Response('Internal error', { status: 500 });
      }
      return new Response('ok', { status: 200 });
    }

    console.log('paymongo-webhook: ignoring unhandled event type', { eventType });
    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('paymongo-webhook: unexpected error', err instanceof Error ? err.message : err);
    return new Response('Internal error', { status: 500 });
  }
});
```

- [ ] **Step 2: Self-review against the spec**

Re-read the spec's "`paymongo-webhook` Edge Function" section against this file. Confirm: raw-body-first signature check, timing-safe compare, idempotent `WHERE status = 'pending'` guard, amount never re-derived from the payload (only `status`/`paymongo_payload` are written), unrecognized events return 200.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/paymongo-webhook/index.ts
git commit -m "feat: add paymongo-webhook Edge Function"
```

---

### Task 7: PayMongo account setup, secrets, deployment, and end-to-end verification

This task is mostly operational (dashboard clicks + deploys), not code. Do these steps in order — later steps depend on secrets/IDs produced by earlier ones.

**Files:** none (Supabase project configuration + PayMongo dashboard).

- [ ] **Step 1: Create a PayMongo account and get the Test Mode secret key**

1. Go to PayMongo's dashboard signup and create an account (business details can be filled minimally/placeholder for Test Mode — Live Mode activation requires real KYC and is explicitly out of scope, per FR-9.6).
2. Once logged in, confirm you're in **Test Mode** (there's a Test/Live toggle in the dashboard — leave it on Test permanently for this project).
3. Go to **Developers → API Keys**. Copy the **Secret Key** (starts with `sk_test_`). Keep it private — this goes into a Supabase secret, never into client code or a committed file.

- [ ] **Step 2: Deploy both Edge Functions**

Using the Supabase MCP tool (`mcp__claude_ai_Supabase__deploy_edge_function`, same mechanism already used for `match-ride-request` per `docs/CHECKLIST.MD`'s "deployed 2026-08-05" note) or the Supabase CLI if available:

- Deploy `supabase/functions/create-gcash-checkout/index.ts` as function name `create-gcash-checkout`.
- Deploy `supabase/functions/paymongo-webhook/index.ts` as function name `paymongo-webhook`.

Confirm both show status `ACTIVE` (use `mcp__claude_ai_Supabase__list_edge_functions` or the dashboard's Edge Functions list).

- [ ] **Step 3: Set the `PAYMONGO_SECRET_KEY` secret**

In the Supabase dashboard, go to **Edge Functions → Manage secrets** (or `supabase secrets set` via CLI if available). Add:
- `PAYMONGO_SECRET_KEY` = the `sk_test_...` value from Step 1.

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are already available to every Edge Function by default — no need to set those manually.

- [ ] **Step 4: Register the webhook endpoint with PayMongo and get its signing secret**

The webhook URL is `https://<your-project-ref>.supabase.co/functions/v1/paymongo-webhook` (get the exact project ref from `mcp__claude_ai_Supabase__get_project_url` if unsure).

1. In the PayMongo dashboard (Test Mode), go to **Developers → Webhooks → Create Webhook** (or use the Create a Webhook API endpoint with your secret key, per the design spec — either path works, dashboard is simpler).
2. Set the URL to the value above.
3. Select events: `checkout_session.payment.paid` and `payment.failed`.
4. Save. The response (or the webhook detail page) shows a **Signing Secret** — copy it.

- [ ] **Step 5: Set the `PAYMONGO_WEBHOOK_SECRET` secret**

Same place as Step 3, add:
- `PAYMONGO_WEBHOOK_SECRET` = the signing secret from Step 4.

Redeploy `paymongo-webhook` if the secret update doesn't take effect on already-running functions (check Supabase docs behavior — some platforms require a redeploy to pick up new secrets; if so, redeploy via the same MCP tool as Step 2).

- [ ] **Step 6: Verify signature verification against a real delivery**

In the PayMongo dashboard, on the webhook you just created, use **"Send test webhook event"** (or equivalent — the exact UI label may differ; look for a "test"/"resend" action on the webhook detail page) for `checkout_session.payment.paid`.

Check the function's logs (`mcp__claude_ai_Supabase__get_logs` for the `paymongo-webhook` function, or the dashboard's Edge Function logs) for:
- A 200 response with no "Invalid signature" warning → the header format matches one of the two branches in `verifySignature`. Good — done.
- A 401 "Invalid signature" warning → note whatever the actual `Paymongo-Signature` header value looked like in the logged warning (it's logged deliberately for this purpose), and adjust `verifySignature` in `supabase/functions/paymongo-webhook/index.ts` to match the real format, then redeploy and retest. This is the one piece of this plan that could genuinely need a follow-up code change based on real-world behavior the docs didn't fully confirm.

- [ ] **Step 7: End-to-end manual QA**

1. Seed or drive the app to a `ride_requests` row with `status = 'completed'` (complete a real trip through the driver app, or update a row directly via the Supabase dashboard for a faster loop).
2. In the passenger app, reach `payment.tsx` for that ride, select GCash, tap "Pay now".
3. Confirm the in-app browser opens PayMongo's hosted checkout page.
4. Use PayMongo's published Test Mode GCash test credentials (check the PayMongo dashboard's Test Mode documentation panel for the current test OTP/redirect flow — this changes over time, don't hardcode a specific test number into this plan) to complete a simulated payment.
5. Confirm `transactions.status` flips to `paid` (check via Supabase dashboard table view, or watch the app itself advance to the rate-driver screen once the Realtime subscription fires).
6. Repeat with a cancelled/failed checkout attempt and confirm the app's retry/cash-fallback UI appears within the 2-minute timeout at most.

- [ ] **Step 8: Update the checklist**

In `docs/CHECKLIST.MD`, check off the "Build `paymongo-webhook` Edge Function" P0 item and add a short note (matching the existing style of the `match-ride-request` and driver-availability entries) describing what was actually built (both Edge Functions, the `final_fare` fix, the client wiring) and any caveats found during Step 6/7 (e.g. which signature-header branch actually matched).

- [ ] **Step 9: Commit the checklist update**

```bash
git add docs/CHECKLIST.MD
git commit -m "docs: mark paymongo-webhook P0 item done"
```

---

## Self-Review Notes

- **Spec coverage**: every numbered step in both Edge Function sections of the design spec has a corresponding line in Tasks 5–6; idempotency (checkout reuse + webhook `WHERE status='pending'`) is covered in both; the `final_fare` gap found during planning is fixed in Task 1 before Task 5 depends on it; client UI states (waiting/failed/retry/cash-fallback) from the spec's "Client changes" section are covered in Task 4.
- **Placeholder scan**: no TBD/TODO markers; the one deliberately-open item (exact signature header format) is called out explicitly as a manual verification step with a concrete fallback action (Task 7 Step 6), not left vague.
- **Type consistency**: `TransactionRow`/`TransactionStatusUpdate` (Task 2) match the `transactions` table shape from `database.types.ts` confirmed during research; `createGcashCheckout`'s `{ checkoutUrl, error }` return shape matches what Task 5's Edge Function returns and what Task 4's `payment.tsx` destructures.
