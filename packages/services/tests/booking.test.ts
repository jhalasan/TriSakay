import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import { createRideRequest, cancelRideRequest, subscribeToRideRequestStatus } from '../src/booking/index.ts';

test('createRideRequest inserts the full payload and returns the row', async () => {
  let capturedInsert: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: (table) => {
        assert.equal(table, 'ride_requests');
        return {
          insert: (row: unknown) => {
            capturedInsert = row;
            return {
              select: () => ({
                single: async () => ({ data: { id: 'rr1', ...(row as object) }, error: null }),
              }),
            };
          },
        };
      },
    })
  );

  const { data, error } = await createRideRequest({
    passengerId: 'p1',
    pickup: { latitude: 6.11, longitude: 125.17, label: 'Home' },
    dropoff: { latitude: 6.12, longitude: 125.18, label: 'Mall' },
    seats: 2,
    distanceKm: 1.4,
    estimatedFare: 18,
    preferredMethod: 'cash',
    discountApplied: true,
    discountPercent: 20,
  });

  assert.equal(error, null);
  assert.equal(data?.id, 'rr1');
  assert.deepEqual(capturedInsert, {
    passenger_id: 'p1',
    pickup_lat: 6.11,
    pickup_lng: 125.17,
    pickup_label: 'Home',
    dest_lat: 6.12,
    dest_lng: 125.18,
    dest_label: 'Mall',
    seats_requested: 2,
    distance_km: 1.4,
    estimated_fare: 18,
    preferred_method: 'cash',
    discount_applied: true,
    discount_percent: 20,
  });
});

test('createRideRequest surfaces the Postgres error message', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: { message: 'insert failed' } }),
          }),
        }),
      }),
    })
  );

  const { data, error } = await createRideRequest({
    passengerId: 'p1',
    pickup: { latitude: 0, longitude: 0, label: 'A' },
    dropoff: { latitude: 0, longitude: 0, label: 'B' },
    seats: 1,
    distanceKm: 1,
    estimatedFare: 15,
    preferredMethod: 'cash',
    discountApplied: false,
    discountPercent: null,
  });

  assert.equal(data, null);
  assert.equal(error, 'insert failed');
});

test('cancelRideRequest updates status to cancelled and returns no error on success', async () => {
  let capturedUpdate: any = null;
  let capturedId: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: (table) => {
        assert.equal(table, 'ride_requests');
        return {
          update: (row: unknown) => {
            capturedUpdate = row;
            return {
              eq: (column: string, value: unknown) => {
                assert.equal(column, 'id');
                capturedId = value;
                return {
                  select: () => ({
                    maybeSingle: async () => ({ data: { id: value, status: 'cancelled' }, error: null }),
                  }),
                };
              },
            };
          },
        };
      },
    })
  );

  const { error } = await cancelRideRequest('rr1', 'Cancelled by passenger');
  assert.equal(error, null);
  assert.equal(capturedId, 'rr1');
  assert.equal(capturedUpdate.status, 'cancelled');
  assert.equal(capturedUpdate.cancel_reason, 'Cancelled by passenger');
});

test('cancelRideRequest reports a plain error when RLS rejects the update (already assigned)', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: () => ({
        update: () => ({
          eq: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    })
  );

  const { error } = await cancelRideRequest('rr1', 'Cancelled by passenger');
  assert.equal(error, 'Could not cancel — this ride may already be assigned or no longer active.');
});

test('cancelRideRequest surfaces a genuine Postgres error', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: () => ({
        update: () => ({
          eq: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: null, error: { message: 'network error' } }),
            }),
          }),
        }),
      }),
    })
  );

  const { error } = await cancelRideRequest('rr1', 'Cancelled by passenger');
  assert.equal(error, 'network error');
});

test('subscribeToRideRequestStatus filters on the row id and forwards status updates', async () => {
  let capturedArgs: any = null;
  let capturedHandler: ((payload: unknown) => void) | null = null;
  let capturedStatusCallback: ((status: string) => void) | null = null;
  let removedChannel: unknown = null;
  const fakeChannel = {
    on: (_event: string, filterArgs: unknown, handler: (payload: unknown) => void) => {
      capturedArgs = filterArgs;
      capturedHandler = handler;
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
        assert.equal(name, 'ride_request_status_rr1');
        return fakeChannel;
      },
      removeChannel: (channel: unknown) => {
        removedChannel = channel;
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    })
  );

  const received: unknown[] = [];
  const unsubscribe = subscribeToRideRequestStatus('rr1', (row) => received.push(row));

  assert.equal(capturedArgs.filter, 'id=eq.rr1');
  assert.equal(capturedArgs.event, 'UPDATE');
  assert.equal(capturedArgs.table, 'ride_requests');
  assert.ok(capturedStatusCallback);

  capturedHandler!({ new: { id: 'rr1', status: 'assigned' } });
  assert.deepEqual(received, [{ id: 'rr1', status: 'assigned' }]);

  unsubscribe();
  assert.equal(removedChannel, fakeChannel);
});

interface FakeStatusChannel {
  on: () => FakeStatusChannel;
  subscribe: (statusCallback?: (status: string) => void) => FakeStatusChannel;
}

test('subscribeToRideRequestStatus reconciles once the channel reports SUBSCRIBED', async () => {
  const captured: { statusCallback: ((status: string) => void) | null } = { statusCallback: null };
  let capturedTable: string | null = null;
  let capturedSelect: string | null = null;
  let capturedEqArgs: [string, unknown] | null = null;
  const fakeChannel: FakeStatusChannel = {
    on: () => fakeChannel,
    subscribe: (statusCallback?: (status: string) => void) => {
      captured.statusCallback = statusCallback ?? null;
      return fakeChannel;
    },
  };

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      channel: () => fakeChannel,
      removeChannel: () => {},
      from: (table: string) => {
        capturedTable = table;
        return {
          select: (columns: string) => {
            capturedSelect = columns;
            return {
              eq: (column: string, value: unknown) => {
                capturedEqArgs = [column, value];
                return {
                  maybeSingle: async () => ({ data: { id: 'rr1', status: 'assigned' }, error: null }),
                };
              },
            };
          },
        };
      },
    })
  );

  const received: unknown[] = [];
  subscribeToRideRequestStatus('rr1', (row) => received.push(row));

  const statusCallback = captured.statusCallback;
  assert.ok(statusCallback);
  statusCallback('SUBSCRIBED');

  // The reconcile query is async — flush microtasks.
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(capturedTable, 'ride_requests');
  assert.equal(capturedSelect, 'id, status');
  assert.deepEqual(capturedEqArgs, ['id', 'rr1']);
  assert.deepEqual(received, [{ id: 'rr1', status: 'assigned' }]);
});

test('subscribeToRideRequestStatus calls onError when the channel errors out or times out', async () => {
  const captured: { statusCallback: ((status: string) => void) | null } = { statusCallback: null };
  const fakeChannel: FakeStatusChannel = {
    on: () => fakeChannel,
    subscribe: (statusCallback?: (status: string) => void) => {
      captured.statusCallback = statusCallback ?? null;
      return fakeChannel;
    },
  };

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      channel: () => fakeChannel,
      removeChannel: () => {},
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    })
  );

  const errors: string[] = [];
  subscribeToRideRequestStatus(
    'rr1',
    () => {},
    (message) => errors.push(message),
  );

  const statusCallback = captured.statusCallback;
  assert.ok(statusCallback);
  statusCallback('CHANNEL_ERROR');
  statusCallback('TIMED_OUT');

  assert.deepEqual(errors, [
    'Lost connection while waiting for a driver. Please check your connection.',
    'Lost connection while waiting for a driver. Please check your connection.',
  ]);
});
