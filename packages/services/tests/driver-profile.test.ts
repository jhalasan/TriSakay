import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import { getDriverVerificationStatus } from '../src/driver-profile/index.ts';

const SESSION = { data: { session: { user: { id: 'u1' } } } };

function driverProfilesTable(row: { verification_status: string } | null, selectError?: string) {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () =>
      selectError ? { data: null, error: { message: selectError } } : { data: row, error: null },
  };
  return query;
}

test('getDriverVerificationStatus reports the row status when one exists', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: (table) => (table === 'driver_profiles' ? driverProfilesTable({ verification_status: 'approved' }) : {}),
    })
  );

  const { status, error } = await getDriverVerificationStatus();
  assert.equal(error, null);
  assert.equal(status, 'approved');
});

test('getDriverVerificationStatus treats a missing row as unsubmitted, not an error', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: (table) => (table === 'driver_profiles' ? driverProfilesTable(null) : {}),
    })
  );

  const { status, error } = await getDriverVerificationStatus();
  assert.equal(error, null);
  assert.equal(status, 'unsubmitted');
});

test('getDriverVerificationStatus surfaces a query error instead of guessing a status', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: (table) => (table === 'driver_profiles' ? driverProfilesTable(null, 'network down') : {}),
    })
  );

  const { status, error } = await getDriverVerificationStatus();
  assert.equal(status, null);
  assert.equal(error, 'network down');
});

test('getDriverVerificationStatus returns an error when there is no active session', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ getSession: async () => ({ data: { session: null } }) })
  );

  const { status, error } = await getDriverVerificationStatus();
  assert.equal(status, null);
  assert.equal(error, 'Not signed in');
});
