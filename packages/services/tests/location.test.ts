import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import { updateDriverAvailability, pushDriverLocation, subscribeToDriverLocation } from '../src/location/index.ts';

const SESSION = { data: { session: { user: { id: 'u1' } } } };

function driverProfilesTable(config: { onUpdate?: (patch: unknown) => void; updateError?: string }) {
  const query = {
    update: (patch: unknown) => {
      config.onUpdate?.(patch);
      return query;
    },
    eq: async () => ({ error: config.updateError ? { message: config.updateError } : null }),
  };
  return query;
}

test('updateDriverAvailability(true, coords) writes is_available and the coordinates', async () => {
  let captured: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: (table) =>
        table === 'driver_profiles' ? driverProfilesTable({ onUpdate: (patch) => (captured = patch) }) : {},
    })
  );

  const { error } = await updateDriverAvailability(true, { lat: 6.1164, lng: 125.1716 });
  assert.equal(error, null);
  assert.equal(captured.is_available, true);
  assert.equal(captured.current_lat, 6.1164);
  assert.equal(captured.current_lng, 125.1716);
  assert.equal(typeof captured.location_updated_at, 'string');
});

test('updateDriverAvailability(false) sends only is_available — the offline trigger clears location server-side', async () => {
  let captured: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: (table) =>
        table === 'driver_profiles' ? driverProfilesTable({ onUpdate: (patch) => (captured = patch) }) : {},
    })
  );

  const { error } = await updateDriverAvailability(false);
  assert.equal(error, null);
  assert.deepEqual(captured, { is_available: false });
});

test('updateDriverAvailability translates the verification-not-approved trigger error into driver-facing copy', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: (table) =>
        table === 'driver_profiles'
          ? driverProfilesTable({ updateError: 'Driver abc cannot go available: driver verification is not approved' })
          : {},
    })
  );

  const { error } = await updateDriverAvailability(true, { lat: 0, lng: 0 });
  assert.equal(error, "You can't go online yet — your driver verification isn't approved.");
});

test('updateDriverAvailability translates the no-verified-tricycle trigger error into driver-facing copy', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: (table) =>
        table === 'driver_profiles'
          ? driverProfilesTable({ updateError: 'Driver abc cannot go available: no active, verified tricycle assigned' })
          : {},
    })
  );

  const { error } = await updateDriverAvailability(true, { lat: 0, lng: 0 });
  assert.equal(error, "You can't go online yet — you don't have a verified tricycle on file.");
});

test('updateDriverAvailability passes through an unrecognized error verbatim', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: (table) => (table === 'driver_profiles' ? driverProfilesTable({ updateError: 'network down' }) : {}),
    })
  );

  const { error } = await updateDriverAvailability(false);
  assert.equal(error, 'network down');
});

test('updateDriverAvailability returns an error when there is no active session', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ getSession: async () => ({ data: { session: null } }) })
  );

  const { error } = await updateDriverAvailability(true, { lat: 0, lng: 0 });
  assert.equal(error, 'Not signed in');
});

test('pushDriverLocation writes only lat/lng/location_updated_at for the signed-in driver', async () => {
  let captured: any = null;
  let capturedEqArgs: [string, unknown] | null = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: (table) =>
        table === 'driver_profiles'
          ? {
              update: (patch: unknown) => {
                captured = patch;
                return {
                  eq: async (column: string, value: unknown) => {
                    capturedEqArgs = [column, value];
                    return { error: null };
                  },
                };
              },
            }
          : {},
    })
  );

  const { error } = await pushDriverLocation({ lat: 6.12, lng: 125.18 });
  assert.equal(error, null);
  assert.equal(captured.current_lat, 6.12);
  assert.equal(captured.current_lng, 125.18);
  assert.equal(typeof captured.location_updated_at, 'string');
  assert.deepEqual(capturedEqArgs, ['user_id', 'u1']);
});

test('pushDriverLocation returns an error when there is no active session', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ getSession: async () => ({ data: { session: null } }) })
  );
  const { error } = await pushDriverLocation({ lat: 0, lng: 0 });
  assert.equal(error, 'Not signed in');
});

interface FakeLocationChannel {
  on: (event: string, filter: unknown, handler: (payload: { new: Record<string, unknown> }) => void) => FakeLocationChannel;
  subscribe: (statusCallback?: (status: string) => void) => FakeLocationChannel;
}

test('subscribeToDriverLocation filters on the given driver id and maps coordinates', async () => {
  let capturedFilter: any = null;
  // Wrapped in an object, not a bare `let`: a closure-assigned `let` gets
  // control-flow-narrowed back to its `null` initializer at the call site
  // below (TS can't see the fake's subscribe() ran), so `assert.ok` would
  // narrow it to `never` — same pattern as booking.test.ts's SUBSCRIBED-reconcile test.
  const captured: { handler: ((payload: { new: Record<string, unknown> }) => void) | null } = { handler: null };
  const fakeChannel: FakeLocationChannel = {
    on: (_event, filter, handler) => {
      capturedFilter = filter;
      captured.handler = handler;
      return fakeChannel;
    },
    subscribe: () => fakeChannel,
  };
  let removedChannel: unknown = null;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      channel: (name: string) => {
        assert.equal(name, 'driver_location_d1');
        return fakeChannel;
      },
      removeChannel: (channel: unknown) => {
        removedChannel = channel;
      },
    })
  );

  const received: unknown[] = [];
  const unsubscribe = subscribeToDriverLocation('d1', (loc) => received.push(loc));

  assert.equal(capturedFilter.filter, 'user_id=eq.d1');
  assert.equal(capturedFilter.event, 'UPDATE');
  assert.equal(capturedFilter.table, 'driver_locations');
  assert.ok(captured.handler);

  captured.handler({ new: { current_lat: 6.1, current_lng: 125.1, location_updated_at: '2026-08-30T00:00:00Z' } });
  assert.deepEqual(received, [{ lat: 6.1, lng: 125.1, updatedAt: '2026-08-30T00:00:00Z' }]);

  unsubscribe();
  assert.equal(removedChannel, fakeChannel);
});

test('subscribeToDriverLocation maps a null-coordinate row (driver went offline) to a null callback', async () => {
  let capturedHandler: ((payload: { new: Record<string, unknown> }) => void) | null = null;
  const fakeChannel: FakeLocationChannel = {
    on: (_event, _filter, handler) => {
      capturedHandler = handler;
      return fakeChannel;
    },
    subscribe: () => fakeChannel,
  };

  __setSupabaseClientForTests(
    createFakeSupabaseClient({ channel: () => fakeChannel, removeChannel: () => {} })
  );

  const received: unknown[] = [];
  subscribeToDriverLocation('d1', (loc) => received.push(loc));
  capturedHandler!({ new: { current_lat: null, current_lng: null, location_updated_at: null } });
  assert.deepEqual(received, [null]);
});

test('subscribeToDriverLocation reconciles once the channel reports SUBSCRIBED', async () => {
  const captured: { statusCallback: ((status: string) => void) | null } = { statusCallback: null };
  let capturedTable: string | null = null;
  let capturedSelect: string | null = null;
  let capturedEqArgs: [string, unknown] | null = null;
  const fakeChannel: FakeLocationChannel = {
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
      from: (table: string) => {
        capturedTable = table;
        return {
          select: (columns: string) => {
            capturedSelect = columns;
            return {
              eq: (column: string, value: unknown) => {
                capturedEqArgs = [column, value];
                return {
                  maybeSingle: async () => ({
                    data: { current_lat: 6.1, current_lng: 125.1, location_updated_at: '2026-08-30T00:00:00Z' },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      },
    })
  );

  const received: unknown[] = [];
  subscribeToDriverLocation('d1', (loc) => received.push(loc));

  const statusCallback = captured.statusCallback;
  assert.ok(statusCallback);
  statusCallback('SUBSCRIBED');

  // The reconcile query is async — flush microtasks.
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(capturedTable, 'driver_locations');
  assert.equal(capturedSelect, 'current_lat, current_lng, location_updated_at');
  assert.deepEqual(capturedEqArgs, ['user_id', 'd1']);
  assert.deepEqual(received, [{ lat: 6.1, lng: 125.1, updatedAt: '2026-08-30T00:00:00Z' }]);
});
