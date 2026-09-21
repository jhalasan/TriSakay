import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { listRideLogForAdmin } from '../src/admin/rides.ts';

function fakeClient() {
  const rides = [
    {
      id: 'ride1',
      passenger_id: 'p1',
      trip_id: 'trip1',
      status: 'completed',
      pickup_label: 'General Santos City (Dadiangas)',
      dest_label: 'SM Savemore Market',
      requested_at: '2026-09-16T03:10:00.000Z',
      completed_at: '2026-09-16T03:21:00.000Z',
      cancelled_at: null,
      final_fare: 15,
    },
    {
      id: 'ride2',
      passenger_id: 'p2',
      trip_id: null,
      status: 'cancelled',
      pickup_label: 'Polomolok',
      dest_label: 'Jollibee',
      requested_at: '2026-09-15T09:40:00.000Z',
      completed_at: null,
      cancelled_at: '2026-09-15T09:45:00.000Z',
      final_fare: null,
    },
  ];
  const trips = [{ id: 'trip1', driver_id: 'd1' }];
  const alerts = [{ ride_request_id: 'ride1' }];
  const users = [
    { id: 'p1', full_name: 'Jay Bee Halasan' },
    { id: 'p2', full_name: 'Prinz' },
    { id: 'd1', full_name: 'prinz' },
  ];

  return {
    from: (table: string) => {
      if (table === 'ride_requests') {
        return {
          select: () => ({
            gte: () => ({
              order: async () => ({ data: rides, error: null }),
            }),
          }),
        };
      }
      if (table === 'trips') {
        return { select: () => ({ in: async () => ({ data: trips, error: null }) }) };
      }
      if (table === 'emergency_alerts') {
        return { select: () => ({ in: async () => ({ data: alerts, error: null }) }) };
      }
      if (table === 'users') {
        return { select: () => ({ in: async () => ({ data: users, error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any;
}

test('listRideLogForAdmin resolves passenger/driver names and flags the emergency-linked ride', async () => {
  __setSupabaseClientForTests(fakeClient());

  const { data, error } = await listRideLogForAdmin('2026-09-01T00:00:00.000Z');
  assert.equal(error, null);
  assert.equal(data.length, 2);

  assert.deepEqual(data[0], {
    id: 'ride1',
    passengerName: 'Jay Bee Halasan',
    driverName: 'prinz',
    status: 'completed',
    pickupLabel: 'General Santos City (Dadiangas)',
    destLabel: 'SM Savemore Market',
    requestedAt: '2026-09-16T03:10:00.000Z',
    completedAt: '2026-09-16T03:21:00.000Z',
    cancelledAt: null,
    finalFare: 15,
    hasEmergencyAlert: true,
  });
});

test('listRideLogForAdmin leaves driverName null for a ride with no trip yet (pending/cancelled-before-assignment)', async () => {
  __setSupabaseClientForTests(fakeClient());

  const { data } = await listRideLogForAdmin('2026-09-01T00:00:00.000Z');
  const cancelled = data.find((r) => r.id === 'ride2');
  assert.equal(cancelled?.driverName, null);
  assert.equal(cancelled?.hasEmergencyAlert, false);
});

test('listRideLogForAdmin returns an empty array without querying other tables when there are no rides in range', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'ride_requests') {
        return { select: () => ({ gte: () => ({ order: async () => ({ data: [], error: null }) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listRideLogForAdmin('2026-09-01T00:00:00.000Z');
  assert.equal(error, null);
  assert.deepEqual(data, []);
});

test('listRideLogForAdmin surfaces a query error instead of guessing', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ gte: () => ({ order: async () => ({ data: null, error: { message: 'network down' } }) }) }) }),
  } as any);

  const { data, error } = await listRideLogForAdmin('2026-09-01T00:00:00.000Z');
  assert.equal(error, 'network down');
  assert.deepEqual(data, []);
});
