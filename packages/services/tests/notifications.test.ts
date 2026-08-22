import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import { markAllNotificationsRead, registerPushToken, subscribeToNotifications } from '../src/notifications/index.ts';

test('markAllNotificationsRead updates only the signed-in user\'s unread rows', async () => {
  let capturedUpdate: any = null;
  const capturedFilters: { column: string; value: unknown }[] = [];

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
      from: (table) => {
        assert.equal(table, 'notifications');
        return {
          update: (row: unknown) => {
            capturedUpdate = row;
            return {
              eq: (column: string, value: unknown) => {
                capturedFilters.push({ column, value });
                return {
                  eq: (column2: string, value2: unknown) => {
                    capturedFilters.push({ column: column2, value: value2 });
                    return Promise.resolve({ error: null });
                  },
                };
              },
            };
          },
        };
      },
    })
  );

  const { error } = await markAllNotificationsRead();

  assert.equal(error, null);
  assert.deepEqual(capturedUpdate, { is_read: true });
  assert.deepEqual(capturedFilters, [
    { column: 'user_id', value: 'u1' },
    { column: 'is_read', value: false },
  ]);
});

test('markAllNotificationsRead returns an error when there is no active session', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient({ getSession: async () => ({ data: { session: null } }) }));

  const { error } = await markAllNotificationsRead();
  assert.equal(error, 'Not signed in');
});

test('registerPushToken writes the token to the signed-in user\'s own row', async () => {
  let capturedTable: string | null = null;
  let capturedUpdate: any = null;
  let capturedFilter: { column: string; value: unknown } | null = null;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
      from: (table) => {
        capturedTable = table;
        return {
          update: (row: unknown) => {
            capturedUpdate = row;
            return {
              eq: (column: string, value: unknown) => {
                capturedFilter = { column, value };
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      },
    })
  );

  const { error } = await registerPushToken('ExponentPushToken[abc123]');

  assert.equal(error, null);
  assert.equal(capturedTable, 'users');
  assert.deepEqual(capturedUpdate, { push_token: 'ExponentPushToken[abc123]' });
  assert.deepEqual(capturedFilter, { column: 'id', value: 'u1' });
});

test('registerPushToken(null) clears the stored token (disabling push notifications)', async () => {
  let capturedUpdate: any = null;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
      from: () => ({
        update: (row: unknown) => {
          capturedUpdate = row;
          return { eq: () => Promise.resolve({ error: null }) };
        },
      }),
    })
  );

  const { error } = await registerPushToken(null);

  assert.equal(error, null);
  assert.deepEqual(capturedUpdate, { push_token: null });
});

test('registerPushToken returns an error when there is no active session', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient({ getSession: async () => ({ data: { session: null } }) }));

  const { error } = await registerPushToken('ExponentPushToken[abc123]');
  assert.equal(error, 'Not signed in');
});

interface FakeChannel {
  on: (event: string, filterArgs: unknown, handler: () => void) => FakeChannel;
  subscribe: (statusCallback?: (status: string) => void) => FakeChannel;
}

test('subscribeToNotifications filters on user_id and reconciles on SUBSCRIBED', async () => {
  let capturedChannelName: string | null = null;
  let capturedOnArgs: any = null;
  const captured: { statusCallback: ((status: string) => void) | null } = { statusCallback: null };
  const fakeChannel: FakeChannel = {
    on: (event, filterArgs) => {
      assert.equal(event, 'postgres_changes');
      capturedOnArgs = filterArgs;
      return fakeChannel;
    },
    subscribe: (statusCallback) => {
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
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () =>
              Promise.resolve({
                data: [{ id: 'n1', title: 'Verification approved', message: 'Go online now.', is_read: false, created_at: 'now' }],
                error: null,
              }),
          }),
        }),
      }),
    })
  );

  const received: unknown[] = [];
  const unsubscribe = subscribeToNotifications('u1', (rows) => received.push(rows));

  assert.equal(capturedChannelName, 'notifications_u1');
  assert.equal(capturedOnArgs.filter, 'user_id=eq.u1');
  assert.equal(capturedOnArgs.table, 'notifications');

  captured.statusCallback!('SUBSCRIBED');
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(received, [
    [{ id: 'n1', title: 'Verification approved', message: 'Go online now.', is_read: false, created_at: 'now' }],
  ]);

  unsubscribe();
});

test('subscribeToNotifications forwards channel errors', async () => {
  const captured: { statusCallback: ((status: string) => void) | null } = { statusCallback: null };
  const fakeChannel: FakeChannel = {
    on: () => fakeChannel,
    subscribe: (statusCallback) => {
      captured.statusCallback = statusCallback ?? null;
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
  subscribeToNotifications('u1', () => {}, (message) => errors.push(message));

  captured.statusCallback!('CHANNEL_ERROR');
  captured.statusCallback!('TIMED_OUT');

  assert.deepEqual(errors, [
    'Lost connection while listening for notifications. Please check your connection.',
    'Lost connection while listening for notifications. Please check your connection.',
  ]);
});

test('subscribeToNotifications unsubscribe removes the channel', async () => {
  const fakeChannel: FakeChannel = {
    on: () => fakeChannel,
    subscribe: () => fakeChannel,
  };
  let removedChannel: unknown = null;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      channel: () => fakeChannel,
      removeChannel: (channel) => {
        removedChannel = channel;
      },
    })
  );

  const unsubscribe = subscribeToNotifications('u1', () => {});
  unsubscribe();

  assert.equal(removedChannel, fakeChannel);
});
