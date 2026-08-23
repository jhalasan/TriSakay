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

test('subscribe(userId) populates items from the reconcile query on SUBSCRIBED', async () => {
  const { useNotificationsStore } = await import('../src/store/useNotificationsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  const { channel, fireSubscribed } = makeChannel();
  __setSupabaseClientForTests({
    channel: () => channel,
    removeChannel: () => {},
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () =>
            Promise.resolve({
              data: [{ id: 'n1', title: 'Verification approved', message: "You're good to go online.", is_read: false, created_at: '2026-08-10T00:00:00.000Z', type: 'verification_status' }],
              error: null,
            }),
        }),
      }),
    }),
  });

  useNotificationsStore.setState({ items: [], error: null });
  useNotificationsStore.getState().subscribe('driver1');
  fireSubscribed();
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(useNotificationsStore.getState().items, [
    { id: 'n1', title: 'Verification approved', body: "You're good to go online.", read: false, createdAt: '2026-08-10T00:00:00.000Z', type: 'verification_status' },
  ]);

  useNotificationsStore.getState().unsubscribe();
});

test('unsubscribe() clears items and tears down the channel', async () => {
  const { useNotificationsStore } = await import('../src/store/useNotificationsStore.ts');
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
          order: () =>
            Promise.resolve({
              data: [{ id: 'n1', title: 'x', message: 'y', is_read: false, created_at: 'now', type: 'ride_status' }],
              error: null,
            }),
        }),
      }),
    }),
  });

  useNotificationsStore.setState({ items: [], error: null });
  useNotificationsStore.getState().subscribe('driver1');
  fireSubscribed();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(useNotificationsStore.getState().items.length, 1);

  useNotificationsStore.getState().unsubscribe();

  assert.equal(useNotificationsStore.getState().items.length, 0);
  assert.equal(removedChannel, channel);
});

test('markAllRead() optimistically flips read locally, then writes through', async () => {
  const { useNotificationsStore } = await import('../src/store/useNotificationsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  let capturedUpdate = null;
  __setSupabaseClientForTests({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'driver1' } } } }) },
    channel: () => { throw new Error('channel not needed for this test'); },
    removeChannel: () => {},
    from: () => ({
      update: (row) => {
        capturedUpdate = row;
        return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) };
      },
    }),
  });

  useNotificationsStore.setState({
    items: [
      { id: 'n1', title: 'a', body: 'b', read: false, createdAt: 'now', type: 'ride_status' },
      { id: 'n2', title: 'c', body: 'd', read: false, createdAt: 'now', type: 'ride_status' },
    ],
    error: null,
  });

  await useNotificationsStore.getState().markAllRead();

  assert.ok(useNotificationsStore.getState().items.every((item) => item.read));
  assert.equal(capturedUpdate.is_read, true);
  assert.equal(useNotificationsStore.getState().error, null);
});

test('markAllRead() surfaces an error when the write fails', async () => {
  const { useNotificationsStore } = await import('../src/store/useNotificationsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'driver1' } } } }) },
    channel: () => { throw new Error('channel not needed for this test'); },
    removeChannel: () => {},
    from: () => ({
      update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: { message: 'network error' } }) }) }),
    }),
  });

  const unreadItems = [{ id: 'n1', title: 'a', body: 'b', read: false, createdAt: 'now', type: 'ride_status' }];
  useNotificationsStore.setState({ items: unreadItems, error: null });
  await useNotificationsStore.getState().markAllRead();

  assert.equal(useNotificationsStore.getState().error, 'network error');
  assert.deepEqual(useNotificationsStore.getState().items, unreadItems, 'failed write should roll back the optimistic read flip');
});

test('markRead(id) optimistically flips one item read, then writes through', async () => {
  const { useNotificationsStore } = await import('../src/store/useNotificationsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  let capturedId = null;
  __setSupabaseClientForTests({
    channel: () => { throw new Error('channel not needed for this test'); },
    removeChannel: () => {},
    from: () => ({
      update: () => ({
        eq: (_col, id) => {
          capturedId = id;
          return Promise.resolve({ error: null });
        },
      }),
    }),
  });

  useNotificationsStore.setState({
    items: [
      { id: 'n1', title: 'a', body: 'b', read: false, createdAt: 'now', type: 'ride_status' },
      { id: 'n2', title: 'c', body: 'd', read: false, createdAt: 'now', type: 'ride_status' },
    ],
    error: null,
  });

  await useNotificationsStore.getState().markRead('n1');

  const items = useNotificationsStore.getState().items;
  assert.equal(items.find((item) => item.id === 'n1')?.read, true);
  assert.equal(items.find((item) => item.id === 'n2')?.read, false);
  assert.equal(capturedId, 'n1');
});

test('markRead(id) surfaces an error and rolls back when the write fails', async () => {
  const { useNotificationsStore } = await import('../src/store/useNotificationsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    channel: () => { throw new Error('channel not needed for this test'); },
    removeChannel: () => {},
    from: () => ({
      update: () => ({ eq: () => Promise.resolve({ error: { message: 'network error' } }) }),
    }),
  });

  const unreadItems = [{ id: 'n1', title: 'a', body: 'b', read: false, createdAt: 'now', type: 'ride_status' }];
  useNotificationsStore.setState({ items: unreadItems, error: null });
  await useNotificationsStore.getState().markRead('n1');

  assert.equal(useNotificationsStore.getState().error, 'network error');
  assert.deepEqual(useNotificationsStore.getState().items, unreadItems, 'failed write should roll back the optimistic read flip');
});
