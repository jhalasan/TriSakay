import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import {
  UNPAID_RIDE_CUTOFF_ISO,
  confirmCashPayment,
  createGcashCheckout,
  getTransactionStatus,
  getUnpaidCompletedRide,
  requestGcashPayment,
  subscribeToTransactionStatus,
  subscribeToTripTransactions,
  switchPaymentToCash,
  verifyGcashPayment,
} from '../src/payments/index.ts';

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

  assert.ok(capturedChannelName?.startsWith('transaction_status_rr1'));
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

test('requestGcashPayment calls the RPC with the ride id and returns the timestamp', async () => {
  const calls: { fn: string; args: unknown }[] = [];
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn, args) => {
        calls.push({ fn, args });
        return { data: '2026-09-30T10:00:00.000Z', error: null };
      },
    })
  );

  const result = await requestGcashPayment('rr1');

  assert.deepEqual(calls, [{ fn: 'request_gcash_payment', args: { p_ride_request_id: 'rr1' } }]);
  assert.deepEqual(result, { requestedAt: '2026-09-30T10:00:00.000Z', error: null });
});

test('requestGcashPayment surfaces the RPC error message', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ rpc: async () => ({ data: null, error: { message: 'This ride is paying by cash' } }) })
  );

  assert.deepEqual(await requestGcashPayment('rr1'), { requestedAt: null, error: 'This ride is paying by cash' });
});

test('switchPaymentToCash passes the ride id and reason code and surfaces errors', async () => {
  const calls: { fn: string; args: unknown }[] = [];
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn, args) => {
        calls.push({ fn, args });
        return { data: null, error: null };
      },
    })
  );

  assert.deepEqual(await switchPaymentToCash('rr1', 'no_signal'), { error: null });
  assert.deepEqual(calls, [{ fn: 'switch_payment_to_cash', args: { p_ride_request_id: 'rr1', p_reason_code: 'no_signal' } }]);

  __setSupabaseClientForTests(
    createFakeSupabaseClient({ rpc: async () => ({ data: null, error: { message: 'This ride is already paid by GCash' } }) })
  );
  assert.deepEqual(await switchPaymentToCash('rr1', 'other'), { error: 'This ride is already paid by GCash' });
});

test('getTransactionStatus returns the row status, or null when there is no row', async () => {
  const makeClient = (row: unknown) =>
    createFakeSupabaseClient({
      from: (table) => {
        assert.equal(table, 'transactions');
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) };
      },
    });

  __setSupabaseClientForTests(makeClient({ status: 'paid' }));
  assert.deepEqual(await getTransactionStatus('rr1'), { status: 'paid', error: null });

  __setSupabaseClientForTests(makeClient(null));
  assert.deepEqual(await getTransactionStatus('rr1'), { status: null, error: null });
});

test('verifyGcashPayment invokes create-gcash-checkout with the verify action', async () => {
  let captured: { name: string; options: unknown } | null = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      functionsInvoke: async (name, options) => {
        captured = { name, options };
        return { data: { status: 'paid' }, error: null };
      },
    })
  );

  assert.deepEqual(await verifyGcashPayment('rr1'), { status: 'paid', error: null });
  assert.deepEqual(captured, { name: 'create-gcash-checkout', options: { body: { rideRequestId: 'rr1', action: 'verify' } } });
});

test('verifyGcashPayment returns a null status and the message when the function errors', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ functionsInvoke: async () => ({ data: null, error: { message: 'Edge Function returned a non-2xx status code' } }) })
  );

  const result = await verifyGcashPayment('rr1');
  assert.equal(result.status, null);
  assert.equal(result.error, 'Edge Function returned a non-2xx status code');
});

test('getUnpaidCompletedRide returns the newest completed ride whose transaction is not paid', async () => {
  const afterCutoff = '2026-10-02T00:00:00.000Z';
  const beforeCutoff = '2026-09-01T00:00:00.000Z';
  const rows = [
    { id: 'paid-one', final_fare: 40, estimated_fare: 40, preferred_method: 'cash', completed_at: afterCutoff, transactions: { status: 'paid' } },
    { id: 'unpaid-one', final_fare: 55, estimated_fare: 55, preferred_method: 'gcash', completed_at: afterCutoff, transactions: [{ status: 'pending' }] },
    { id: 'old-unpaid', final_fare: 30, estimated_fare: 30, preferred_method: 'gcash', completed_at: beforeCutoff, transactions: null },
  ];
  const makeChain = (data: unknown) => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      gte: () => chain,
      order: () => chain,
      limit: async () => ({ data, error: null }),
    };
    return chain;
  };
  __setSupabaseClientForTests(createFakeSupabaseClient({ from: () => makeChain(rows) }));

  const { data, error } = await getUnpaidCompletedRide('p1');

  assert.equal(error, null);
  assert.deepEqual(data, { rideRequestId: 'unpaid-one', fare: 55, method: 'gcash' });

  __setSupabaseClientForTests(createFakeSupabaseClient({ from: () => makeChain([rows[0]]) }));
  assert.deepEqual(await getUnpaidCompletedRide('p1'), { data: null, error: null });
  assert.ok(UNPAID_RIDE_CUTOFF_ISO.startsWith('2026-09-30'));
});

test('subscribeToTripTransactions listens on the transactions table, fires onChange, and removes the channel', async () => {
  let capturedArgs: any = null;
  let capturedHandler: ((payload: unknown) => void) | null = null;
  let removedChannel: unknown = null;
  const fakeChannel = {
    on: (_event: string, filterArgs: unknown, handler: (payload: unknown) => void) => {
      capturedArgs = filterArgs;
      capturedHandler = handler;
      return fakeChannel;
    },
    subscribe: () => fakeChannel,
  };
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      channel: (name: string) => {
        assert.ok(name.startsWith('trip_transactions'), `unexpected channel name ${name}`);
        return fakeChannel;
      },
      removeChannel: (channel: unknown) => {
        removedChannel = channel;
      },
    })
  );

  let changes = 0;
  const unsubscribe = subscribeToTripTransactions(() => {
    changes += 1;
  });

  assert.equal(capturedArgs.table, 'transactions');
  assert.equal(capturedArgs.schema, 'public');
  capturedHandler!({ new: { status: 'paid' } });
  assert.equal(changes, 1);

  unsubscribe();
  assert.equal(removedChannel, fakeChannel);
});
