import test from 'node:test';
import assert from 'node:assert/strict';

function makeChannel() {
  let changeHandler: (() => void) | null = null;
  let statusCallback: ((status: string) => void) | null = null;
  const channel: any = {
    on: (_event: unknown, _filterArgs: unknown, handler: () => void) => {
      changeHandler = handler;
      return channel;
    },
    subscribe: (cb?: (status: string) => void) => {
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
              data: [{ id: 'n1', title: 'Ride matched', message: 'A driver is on the way.', is_read: false, created_at: '2026-08-14T00:00:00.000Z' }],
              error: null,
            }),
        }),
      }),
    }),
  } as any);

  useNotificationsStore.setState({ items: [], error: null });
  useNotificationsStore.getState().subscribe('passenger1');
  fireSubscribed();
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(useNotificationsStore.getState().items, [
    { id: 'n1', title: 'Ride matched', body: 'A driver is on the way.', read: false, createdAt: '2026-08-14T00:00:00.000Z' },
  ]);

  useNotificationsStore.getState().unsubscribe();
});

test('unsubscribe() clears items and tears down the channel', async () => {
  const { useNotificationsStore } = await import('../src/store/useNotificationsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  const { channel, fireSubscribed } = makeChannel();
  let removedChannel: unknown = null;
  __setSupabaseClientForTests({
    channel: () => channel,
    removeChannel: (ch: unknown) => {
      removedChannel = ch;
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () =>
            Promise.resolve({
              data: [{ id: 'n1', title: 'x', message: 'y', is_read: false, created_at: 'now' }],
              error: null,
            }),
        }),
      }),
    }),
  } as any);

  useNotificationsStore.setState({ items: [], error: null });
  useNotificationsStore.getState().subscribe('passenger1');
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

  let capturedUpdate: any = null;
  __setSupabaseClientForTests({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'passenger1' } } } }) },
    channel: () => {
      throw new Error('channel not needed for this test');
    },
    removeChannel: () => {},
    from: () => ({
      update: (row: unknown) => {
        capturedUpdate = row;
        return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) };
      },
    }),
  } as any);

  useNotificationsStore.setState({
    items: [
      { id: 'n1', title: 'a', body: 'b', read: false, createdAt: 'now' },
      { id: 'n2', title: 'c', body: 'd', read: false, createdAt: 'now' },
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
    auth: { getSession: async () => ({ data: { session: { user: { id: 'passenger1' } } } }) },
    channel: () => {
      throw new Error('channel not needed for this test');
    },
    removeChannel: () => {},
    from: () => ({
      update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: { message: 'network error' } }) }) }),
    }),
  } as any);

  const unreadItems = [{ id: 'n1', title: 'a', body: 'b', read: false, createdAt: 'now' }];
  useNotificationsStore.setState({ items: unreadItems, error: null });
  await useNotificationsStore.getState().markAllRead();

  assert.equal(useNotificationsStore.getState().error, 'network error');
  assert.deepEqual(useNotificationsStore.getState().items, unreadItems, 'failed write should roll back the optimistic read flip');
});
