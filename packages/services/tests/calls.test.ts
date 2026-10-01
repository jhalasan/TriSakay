import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import {
  answerRideCall,
  declineRideCall,
  endRideCall,
  getCallToken,
  getRideCall,
  listMyActiveCalls,
  startRideCall,
  subscribeToCall,
  subscribeToMyCalls,
} from '../src/calls/index.ts';

const ROW = {
  id: 'c1',
  ride_request_id: 'rr1',
  caller_id: 'p1',
  callee_id: 'd1',
  status: 'ringing',
  is_caller: true,
  age_seconds: 4.2,
  answered_age_seconds: null,
  peer_first_name: 'Jomar',
  peer_avatar_url: 'https://example.test/a.png',
};

test('startRideCall calls the RPC with the ride id and returns the new call id', async () => {
  let captured: { fn: string; args: unknown } | null = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn, args) => {
        captured = { fn, args };
        return { data: 'c1', error: null };
      },
    }),
  );
  assert.deepEqual(await startRideCall('rr1'), { data: 'c1', error: null });
  assert.deepEqual(captured, { fn: 'start_ride_call', args: { p_ride_request_id: 'rr1' } });
});

test('startRideCall returns the database message when the call is refused', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ rpc: async () => ({ data: null, error: { message: 'A call is already in progress for this ride' } }) }),
  );
  assert.deepEqual(await startRideCall('rr1'), { data: null, error: 'A call is already in progress for this ride' });
});

test('answer, decline and end each call their RPC with only the call id', async () => {
  const calls: { fn: string; args: unknown }[] = [];
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn, args) => {
        calls.push({ fn, args });
        return { data: null, error: null };
      },
    }),
  );
  assert.deepEqual(await answerRideCall('c1'), { error: null });
  assert.deepEqual(await declineRideCall('c1'), { error: null });
  assert.deepEqual(await endRideCall('c1'), { error: null });
  assert.deepEqual(calls, [
    { fn: 'answer_ride_call', args: { p_call_id: 'c1' } },
    { fn: 'decline_ride_call', args: { p_call_id: 'c1' } },
    { fn: 'end_ride_call', args: { p_call_id: 'c1' } },
  ]);
});

test('answerRideCall surfaces the refusal message', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ rpc: async () => ({ data: null, error: { message: 'This call is no longer ringing' } }) }),
  );
  assert.deepEqual(await answerRideCall('c1'), { error: 'This call is no longer ringing' });
});

test('getRideCall maps the row, with the other person\'s first name and photo', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient({ rpc: async () => ({ data: [ROW], error: null }) }));
  assert.deepEqual(await getRideCall('c1'), {
    data: {
      id: 'c1',
      rideRequestId: 'rr1',
      callerId: 'p1',
      calleeId: 'd1',
      status: 'ringing',
      isCaller: true,
      ageSeconds: 4.2,
      answeredAgeSeconds: null,
      peerFirstName: 'Jomar',
      peerAvatarUrl: 'https://example.test/a.png',
    },
    error: null,
  });
});

test('getRideCall returns null data when there is no such call for this user', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient({ rpc: async () => ({ data: [], error: null }) }));
  assert.deepEqual(await getRideCall('nope'), { data: null, error: null });
});

test('listMyActiveCalls maps every row and returns an empty list on error', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient({ rpc: async () => ({ data: [ROW, { ...ROW, id: 'c2', is_caller: false }], error: null }) }));
  const ok = await listMyActiveCalls();
  assert.equal(ok.data.length, 2);
  assert.equal(ok.data[1].isCaller, false);

  __setSupabaseClientForTests(createFakeSupabaseClient({ rpc: async () => ({ data: null, error: { message: 'boom' } }) }));
  assert.deepEqual(await listMyActiveCalls(), { data: [], error: 'boom' });
});

test('getCallToken invokes call-token with only the call id and returns the credentials', async () => {
  let captured: { name: string; options: unknown } | null = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      functionsInvoke: async (name, options) => {
        captured = { name, options };
        return { data: { appId: 'app', channel: 'call_c1', uid: 4242, token: 'tok' }, error: null };
      },
    }),
  );
  assert.deepEqual(await getCallToken('c1'), {
    data: { appId: 'app', channel: 'call_c1', uid: 4242, token: 'tok' },
    error: null,
  });
  assert.deepEqual(captured, { name: 'call-token', options: { body: { callId: 'c1' } } });
});

test('getCallToken surfaces the function\'s own message, and rejects an incomplete answer', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      functionsInvoke: async () => ({
        data: null,
        error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({ error: 'This call has ended' }) } },
      }),
    }),
  );
  assert.deepEqual(await getCallToken('c1'), { data: null, error: 'This call has ended' });

  __setSupabaseClientForTests(createFakeSupabaseClient({ functionsInvoke: async () => ({ data: { appId: 'app' }, error: null }) }));
  assert.deepEqual(await getCallToken('c1'), { data: null, error: 'Could not get a call token' });
});

function fakeChannelHarness() {
  const handlers: (() => void)[] = [];
  const filters: string[] = [];
  const status: { cb: ((s: string) => void) | null } = { cb: null };
  let removed: unknown = null;
  const channel = {
    on: (_type: string, filter: { filter?: string }, handler: () => void) => {
      filters.push(filter.filter ?? '');
      handlers.push(handler);
      return channel;
    },
    subscribe: (cb?: (s: string) => void) => {
      status.cb = cb ?? null;
      return channel;
    },
  };
  return { channel, handlers, filters, status, wasRemoved: () => removed, setRemoved: (c: unknown) => (removed = c) };
}

test('subscribeToCall refetches on SUBSCRIBED and on every change, and removes the channel on unsubscribe', async () => {
  const h = fakeChannelHarness();
  let fetches = 0;
  const seen: unknown[] = [];
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      channel: () => h.channel,
      removeChannel: (c) => h.setRemoved(c),
      rpc: async () => {
        fetches++;
        return { data: [ROW], error: null };
      },
    }),
  );

  const unsubscribe = subscribeToCall('c1', (call) => seen.push(call));
  assert.deepEqual(h.filters, ['id=eq.c1']);
  h.status.cb!('SUBSCRIBED');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(fetches, 1);
  h.handlers[0]();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(fetches, 2);
  assert.equal(seen.length, 2);

  unsubscribe();
  assert.equal(h.wasRemoved(), h.channel);
});

test('subscribeToMyCalls listens for calls to and from the user and reports a channel error', async () => {
  const h = fakeChannelHarness();
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ channel: () => h.channel, removeChannel: (c) => h.setRemoved(c), rpc: async () => ({ data: [], error: null }) }),
  );
  const errors: string[] = [];
  const unsubscribe = subscribeToMyCalls('u1', () => {}, (m) => errors.push(m));
  assert.deepEqual(h.filters, ['callee_id=eq.u1', 'caller_id=eq.u1']);
  h.status.cb!('CHANNEL_ERROR');
  assert.equal(errors.length, 1);
  unsubscribe();
});
