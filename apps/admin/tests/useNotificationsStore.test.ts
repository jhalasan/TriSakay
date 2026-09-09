import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '@trisakay/services';
import { useNotificationsStore } from '../src/store/useNotificationsStore.ts';

interface FakeChannel {
  on: (event: string, filterArgs: unknown, cb: () => void) => FakeChannel;
  subscribe: (statusCallback?: (status: string) => void) => FakeChannel;
}

function fakeClient(rows: Record<string, unknown>[], opts?: { updateError?: string }) {
  let statusCallback: ((status: string) => void) | null = null;
  const channel: FakeChannel = {
    on: (_event, _filterArgs, _cb) => channel,
    subscribe: (cb) => {
      statusCallback = cb ?? null;
      return channel;
    },
  };

  return {
    client: {
      channel: () => channel,
      removeChannel: () => {},
      from: (table: string) => {
        if (table !== 'notifications') throw new Error(`unexpected table ${table}`);
        return {
          select: () => ({ eq: () => ({ order: async () => ({ data: rows, error: null }) }) }),
          // markNotificationRead awaits after one .eq(); markAllNotificationsRead chains a second .eq() first.
          update: () => ({
            eq: async () => ({ error: opts?.updateError ? { message: opts.updateError } : null }),
          }),
        };
      },
    } as any,
    fireSubscribed: () => statusCallback?.('SUBSCRIBED'),
  };
}

test('connect() subscribes and populates notifications once SUBSCRIBED fires', async () => {
  const { client, fireSubscribed } = fakeClient([
    { id: 'n1', user_id: 'u1', type: 'emergency_alert', title: 'Emergency alert', message: 'Driver triggered SOS.', ref_id: null, is_read: false, created_at: '2026-09-09T10:00:00Z' },
  ]);
  __setSupabaseClientForTests(client);

  useNotificationsStore.getState().connect('u1');
  fireSubscribed();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(useNotificationsStore.getState().notifications.length, 1);
  assert.equal(useNotificationsStore.getState().notifications[0].title, 'Emergency alert');

  useNotificationsStore.getState().disconnect();
  assert.deepEqual(useNotificationsStore.getState().notifications, []);
});

test('markRead() optimistically flips is_read, then rolls back on a service error', async () => {
  const { client } = fakeClient([], { updateError: 'connection refused' });
  __setSupabaseClientForTests(client);

  useNotificationsStore.setState({
    notifications: [{ id: 'n1', user_id: 'u1', type: 'emergency_alert', title: 'T', message: 'M', ref_id: null, is_read: false, created_at: 'now' } as any],
    error: null,
  });

  await useNotificationsStore.getState().markRead('n1');

  assert.equal(useNotificationsStore.getState().error, 'connection refused');
  assert.equal(useNotificationsStore.getState().notifications[0].is_read, false);
});
