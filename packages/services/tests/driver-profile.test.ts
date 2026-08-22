import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import { getDriverEarnings, getDriverRatingSummary, getDriverVerificationStatus } from '../src/driver-profile/index.ts';

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

function driverEarningsView(
  rows: { earning_date: string; rides_completed: number; total_collected: number }[] | null,
  selectError?: string
) {
  let capturedColumn: string | null = null;
  let capturedValue: unknown = null;
  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => {
      capturedColumn = column;
      capturedValue = value;
      return query;
    },
    order: () =>
      selectError
        ? Promise.resolve({ data: null, error: { message: selectError } })
        : Promise.resolve({ data: rows, error: null }),
  };
  return { query, getCapturedFilter: () => ({ column: capturedColumn, value: capturedValue }) };
}

test('getDriverEarnings sums total_collected across every row and returns the daily breakdown, scoped to the signed-in driver', async () => {
  const { query, getCapturedFilter } = driverEarningsView([
    { earning_date: '2026-08-19', rides_completed: 2, total_collected: 45 },
    { earning_date: '2026-08-20', rides_completed: 1, total_collected: 30 },
  ]);
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: (table) => (table === 'v_driver_earnings' ? query : {}),
    })
  );

  const { totalTracked, breakdown, error } = await getDriverEarnings();
  assert.equal(error, null);
  assert.equal(totalTracked, 75);
  assert.deepEqual(breakdown, [
    { date: '2026-08-19', ridesCompleted: 2, totalCollected: 45 },
    { date: '2026-08-20', ridesCompleted: 1, totalCollected: 30 },
  ]);
  assert.deepEqual(getCapturedFilter(), { column: 'driver_id', value: 'u1' });
});

test('getDriverEarnings reports 0 and an empty breakdown when the driver has no completed/paid rides yet', async () => {
  const { query } = driverEarningsView([]);
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: (table) => (table === 'v_driver_earnings' ? query : {}),
    })
  );

  const { totalTracked, breakdown, error } = await getDriverEarnings();
  assert.equal(error, null);
  assert.equal(totalTracked, 0);
  assert.deepEqual(breakdown, []);
});

test('getDriverEarnings surfaces a query error instead of guessing a total or breakdown', async () => {
  const { query } = driverEarningsView(null, 'network down');
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: (table) => (table === 'v_driver_earnings' ? query : {}),
    })
  );

  const { totalTracked, breakdown, error } = await getDriverEarnings();
  assert.equal(totalTracked, null);
  assert.equal(breakdown, null);
  assert.equal(error, 'network down');
});

test('getDriverEarnings returns an error when there is no active session', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ getSession: async () => ({ data: { session: null } }) })
  );

  const { totalTracked, breakdown, error } = await getDriverEarnings();
  assert.equal(totalTracked, null);
  assert.equal(breakdown, null);
  assert.equal(error, 'Not signed in');
});

test('getDriverRatingSummary reports the row values when one exists', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: (table) => (table === 'driver_profiles' ? driverProfilesTable({ rating_avg: 4.7, rating_count: 12 } as any) : {}),
    })
  );

  const { ratingAvg, ratingCount, error } = await getDriverRatingSummary();
  assert.equal(error, null);
  assert.equal(ratingAvg, 4.7);
  assert.equal(ratingCount, 12);
});

test('getDriverRatingSummary treats a missing row as no rating yet, not an error', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: (table) => (table === 'driver_profiles' ? driverProfilesTable(null) : {}),
    })
  );

  const { ratingAvg, ratingCount, error } = await getDriverRatingSummary();
  assert.equal(error, null);
  assert.equal(ratingAvg, null);
  assert.equal(ratingCount, 0);
});

test('getDriverRatingSummary surfaces a query error instead of guessing', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: (table) => (table === 'driver_profiles' ? driverProfilesTable(null, 'network down') : {}),
    })
  );

  const { ratingAvg, error } = await getDriverRatingSummary();
  assert.equal(ratingAvg, null);
  assert.equal(error, 'network down');
});

test('getDriverRatingSummary returns an error when there is no active session', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ getSession: async () => ({ data: { session: null } }) })
  );

  const { ratingAvg, error } = await getDriverRatingSummary();
  assert.equal(ratingAvg, null);
  assert.equal(error, 'Not signed in');
});
