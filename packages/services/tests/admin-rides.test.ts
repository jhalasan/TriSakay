import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { listRideLogForAdmin } from '../src/admin/rides.ts';

function row(i: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `ride-${i}`,
    passenger_name: 'Ana Reyes',
    driver_name: 'Juan Dela Cruz',
    status: 'completed',
    pickup_label: 'Plaza',
    dest_label: 'Market',
    requested_at: '2026-10-03T01:00:00.000Z',
    completed_at: '2026-10-03T01:20:00.000Z',
    cancelled_at: null,
    final_fare: '18.00',
    has_emergency_alert: false,
    fare_flagged: false,
    ...overrides,
  };
}

test('listRideLogForAdmin maps the joined rows, including the SOS and fare flags', async () => {
  const calls: unknown[] = [];
  __setSupabaseClientForTests({
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return { data: [row(1, { has_emergency_alert: true, fare_flagged: true })], error: null };
    },
  } as any);

  const { data, error, truncated } = await listRideLogForAdmin('2026-09-01T00:00:00.000Z');

  assert.equal(error, null);
  assert.equal(truncated, false);
  assert.deepEqual(calls, [{ fn: 'admin_list_ride_log', args: { p_since: '2026-09-01T00:00:00.000Z' } }]);
  assert.deepEqual(data[0], {
    id: 'ride-1',
    passengerName: 'Ana Reyes',
    driverName: 'Juan Dela Cruz',
    status: 'completed',
    pickupLabel: 'Plaza',
    destLabel: 'Market',
    requestedAt: '2026-10-03T01:00:00.000Z',
    completedAt: '2026-10-03T01:20:00.000Z',
    cancelledAt: null,
    finalFare: 18,
    hasEmergencyAlert: true,
    fareFlagged: true,
  });
});

test('listRideLogForAdmin leaves driverName and finalFare null for a ride that never had a driver or a fare', async () => {
  __setSupabaseClientForTests({
    rpc: async () => ({ data: [row(1, { driver_name: null, final_fare: null, status: 'cancelled' })], error: null }),
  } as any);

  const { data } = await listRideLogForAdmin('2026-09-01T00:00:00.000Z');
  assert.equal(data[0].driverName, null);
  assert.equal(data[0].finalFare, null);
});

test('listRideLogForAdmin returns an empty list when there are no rides in range', async () => {
  __setSupabaseClientForTests({ rpc: async () => ({ data: [], error: null }) } as any);

  const { data, error, truncated } = await listRideLogForAdmin('2026-09-01T00:00:00.000Z');
  assert.deepEqual(data, []);
  assert.equal(error, null);
  assert.equal(truncated, false);
});

test('listRideLogForAdmin reports truncated and returns exactly 2000 rows when the database sends the extra row', async () => {
  __setSupabaseClientForTests({ rpc: async () => ({ data: Array.from({ length: 2001 }, (_, i) => row(i)), error: null }) } as any);

  const { data, truncated } = await listRideLogForAdmin('2026-09-01T00:00:00.000Z');
  assert.equal(data.length, 2000);
  assert.equal(truncated, true);
});

test('listRideLogForAdmin surfaces a query error instead of guessing', async () => {
  __setSupabaseClientForTests({ rpc: async () => ({ data: null, error: { message: 'Not allowed' } }) } as any);

  const { data, error } = await listRideLogForAdmin('2026-09-01T00:00:00.000Z');
  assert.deepEqual(data, []);
  assert.equal(error, 'Not allowed');
});
