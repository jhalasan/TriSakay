import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import { confirmCashPayment, createGcashCheckout, subscribeToTransactionStatus } from '../src/payments/index.ts';

test('confirmCashPayment updates the cash transaction to paid with cash_confirmed_by/at', async () => {
  let capturedUpdate: any = null;
  const capturedFilters: { column: string; value: unknown }[] = [];

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: (table) => {
        assert.equal(table, 'transactions');
        return {
          update: (row: unknown) => {
            capturedUpdate = row;
            return {
              eq: (column: string, value: unknown) => {
                capturedFilters.push({ column, value });
                return {
                  eq: (column2: string, value2: unknown) => {
                    capturedFilters.push({ column: column2, value: value2 });
                    return { select: () => ({ maybeSingle: async () => ({ data: { id: 'txn1' }, error: null }) }) };
                  },
                };
              },
            };
          },
        };
      },
    })
  );

  const { error } = await confirmCashPayment('rr1', 'driver1');

  assert.equal(error, null);
  assert.equal(capturedUpdate.status, 'paid');
  assert.equal(capturedUpdate.cash_confirmed_by, 'driver1');
  assert.ok(capturedUpdate.cash_confirmed_at);
  assert.deepEqual(capturedFilters, [
    { column: 'ride_request_id', value: 'rr1' },
    { column: 'method', value: 'cash' },
  ]);
});

test('confirmCashPayment reports a clear error when no cash transaction row exists yet', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: () => ({
        update: () => ({ eq: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }),
      }),
    })
  );

  const { error } = await confirmCashPayment('rr1', 'driver1');
  assert.equal(error, 'No cash payment found for this ride yet. Please try again in a moment.');
});

test('confirmCashPayment surfaces a friendly error on a Postgres failure', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: () => ({
        update: () => ({ eq: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'network error' } }) }) }) }) }),
      }),
    })
  );

  const { error } = await confirmCashPayment('rr1', 'driver1');
  assert.equal(error, "Couldn't confirm cash payment. Please try again.");
});

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
  // This is the REAL shape production sees: create-gcash-checkout responds
  // with a non-2xx status, so the Supabase JS v2 client wraps it in a
  // FunctionsHttpError with a generic `.message` and stashes the actual
  // Response on `.context` — the application error only shows up if we
  // parse that Response's body ourselves.
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      functionsInvoke: async () => ({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: { json: async () => ({ checkoutUrl: null, error: 'Already paid' }) },
        },
      }),
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
