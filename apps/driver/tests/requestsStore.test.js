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

test('subscribe(driverId) populates pending from the reconcile fetch and maps fields correctly', async () => {
  const { useRequestsStore } = await import('../src/store/useRequestsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  const { channel, fireSubscribed } = makeChannel();
  let capturedInvoke = null;
  __setSupabaseClientForTests({
    channel: () => channel,
    removeChannel: () => {},
    functions: {
      invoke: async (name, options) => {
        capturedInvoke = { name, options };
        return {
          data: {
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
          },
          error: null,
        };
      },
    },
  });

  useRequestsStore.setState({ pending: [], error: null });
  useRequestsStore.getState().subscribe('driver1');
  fireSubscribed();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(capturedInvoke.name, 'match-ride-request');
  assert.deepEqual(capturedInvoke.options, { body: { driverId: 'driver1' } });

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
    functions: {
      invoke: async () => ({ data: { data: rows, error: null }, error: null }),
    },
  });

  useRequestsStore.setState({ pending: [], error: null });
  useRequestsStore.getState().subscribe('driver1');
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
  assert.equal(accepted.tripId, 'trip1');
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
    functions: {
      invoke: async () => ({
        data: {
          data: [{ id: 'rr1', seats_requested: 1, preferred_method: 'cash', pickup_label: null, dest_label: null, estimated_fare: null, requested_at: 'now' }],
          error: null,
        },
        error: null,
      }),
    },
  });

  useRequestsStore.setState({ pending: [], error: null });
  useRequestsStore.getState().subscribe('driver1');
  fireSubscribed();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(useRequestsStore.getState().pending.length, 1);

  useRequestsStore.getState().unsubscribe();

  assert.equal(useRequestsStore.getState().pending.length, 0);
  assert.equal(removedChannel, channel);
});
