import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import { updateDriverAvailability } from '../src/location/index.ts';

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
