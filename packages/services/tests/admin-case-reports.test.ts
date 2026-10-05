import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { getCaseContacts, getCaseRide } from '../src/admin/caseReports.ts';

function single(data: unknown, error: { message: string } | null = null) {
  return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data, error }) }) }) };
}

function rideClient(overrides: { ride?: unknown; trip?: unknown; tricycle?: unknown; users?: unknown; rideError?: string } = {}) {
  const ride =
    overrides.ride === undefined
      ? {
          id: 'ride-1',
          passenger_id: 'p1',
          trip_id: 't1',
          status: 'completed',
          pickup_label: 'Plaza',
          dest_label: 'Market',
          requested_at: '2026-10-01T01:00:00.000Z',
          completed_at: '2026-10-01T01:20:00.000Z',
          cancelled_at: null,
          final_fare: 20,
          estimated_fare: 18,
        }
      : overrides.ride;
  return {
    from: (table: string) => {
      if (table === 'ride_requests') return single(ride, overrides.rideError ? { message: overrides.rideError } : null);
      if (table === 'trips') return single(overrides.trip === undefined ? { driver_id: 'd1', tricycle_id: 'tr1' } : overrides.trip);
      if (table === 'tricycles') return single(overrides.tricycle === undefined ? { plate_no: 'GSC-0000' } : overrides.tricycle);
      if (table === 'users') {
        return {
          select: () => ({
            in: async () => ({
              data: overrides.users === undefined ? [{ id: 'p1', full_name: 'Sample Passenger' }, { id: 'd1', full_name: 'Sample Driver' }] : overrides.users,
              error: null,
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any;
}

test('getCaseRide joins the passenger, driver and plate number and prefers the final fare', async () => {
  __setSupabaseClientForTests(rideClient());

  const { data, error } = await getCaseRide('ride-1');

  assert.equal(error, null);
  assert.deepEqual(data, {
    id: 'ride-1',
    status: 'completed',
    requestedAt: '2026-10-01T01:00:00.000Z',
    completedAt: '2026-10-01T01:20:00.000Z',
    cancelledAt: null,
    pickupLabel: 'Plaza',
    destLabel: 'Market',
    fare: 20,
    passengerName: 'Sample Passenger',
    driverName: 'Sample Driver',
    plateNo: 'GSC-0000',
  });
});

test('getCaseRide uses the estimated fare when there is no final fare, and leaves the driver blank for a ride with no trip', async () => {
  __setSupabaseClientForTests(
    rideClient({
      ride: { id: 'ride-2', passenger_id: 'p1', trip_id: null, status: 'cancelled', pickup_label: null, dest_label: null, requested_at: '2026-10-01T01:00:00.000Z', completed_at: null, cancelled_at: '2026-10-01T01:05:00.000Z', final_fare: null, estimated_fare: 18 },
    }),
  );

  const { data } = await getCaseRide('ride-2');
  assert.equal(data?.fare, 18);
  assert.equal(data?.driverName, null);
  assert.equal(data?.plateNo, null);
  assert.equal(data?.cancelledAt, '2026-10-01T01:05:00.000Z');
});

test('getCaseRide returns no data and no error when the ride does not exist, and passes a query error through', async () => {
  __setSupabaseClientForTests(rideClient({ ride: null }));
  assert.deepEqual(await getCaseRide('missing'), { data: null, error: null });

  __setSupabaseClientForTests(rideClient({ rideError: 'connection refused' }));
  assert.deepEqual(await getCaseRide('ride-1'), { data: null, error: 'connection refused' });
});

test('getCaseContacts reads both directories and returns phone and email by user id', async () => {
  const tables: string[] = [];
  __setSupabaseClientForTests({
    from: (table: string) => {
      tables.push(table);
      return {
        select: () => ({
          in: async () => ({
            data:
              table === 'admin_passenger_directory'
                ? [{ id: 'p1', contact_no: '09000000001', email: 'p1@example.test' }]
                : [{ id: 'd1', contact_no: '09000000002', email: null }],
            error: null,
          }),
        }),
      };
    },
  } as any);

  const { data, error } = await getCaseContacts(['p1', 'd1']);

  assert.equal(error, null);
  assert.deepEqual(tables.sort(), ['admin_driver_directory', 'admin_passenger_directory']);
  assert.deepEqual(data, {
    p1: { phone: '09000000001', email: 'p1@example.test' },
    d1: { phone: '09000000002', email: null },
  });
});

test('getCaseContacts gives nothing back for an empty id list without querying', async () => {
  let called = false;
  __setSupabaseClientForTests({
    from: () => {
      called = true;
      return {};
    },
  } as any);

  assert.deepEqual(await getCaseContacts([]), { data: {}, error: null });
  assert.equal(called, false);
});

test('getCaseContacts passes a query error through', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ in: async () => ({ data: null, error: { message: 'permission denied' } }) }) }),
  } as any);

  const { data, error } = await getCaseContacts(['p1']);
  assert.deepEqual(data, {});
  assert.equal(error, 'permission denied');
});
