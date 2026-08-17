import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { listActiveTricyclesForAdmin } from '../src/admin/monitoring.ts';

function fakeClient(overrides: Record<string, unknown> = {}) {
  return {
    from: (table: string) => {
      if (table === 'driver_profiles') {
        return { select: () => ({ eq: async () => ({ data: [{ user_id: 'drv1' }, { user_id: 'drv2' }], error: null }) }) };
      }
      if (table === 'users') {
        return {
          select: () => ({
            in: async () => ({
              data: [
                { id: 'drv1', full_name: 'Ronnie Bautista' },
                { id: 'drv2', full_name: 'Ariel Cabahug' },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'tricycles') {
        return {
          select: () => ({
            in: () => ({
              eq: async () => ({
                data: [
                  { driver_id: 'drv1', plate_no: 'GSC-1187', seat_capacity: 6 },
                  { driver_id: 'drv2', plate_no: 'GSC-2214', seat_capacity: 4 },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'trips') {
        return {
          select: () => ({
            in: () => ({ eq: async () => ({ data: [{ id: 'trip1', driver_id: 'drv1', max_seats: 6 }], error: null }) }),
          }),
        };
      }
      if (table === 'ride_requests') {
        return {
          select: () => ({
            in: () => ({ in: async () => ({ data: [{ trip_id: 'trip1', seats_requested: 2 }, { trip_id: 'trip1', seats_requested: 1 }], error: null }) }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    ...overrides,
  } as any;
}

test('listActiveTricyclesForAdmin splits on-duty drivers into active (with summed seats) vs idle', async () => {
  __setSupabaseClientForTests(fakeClient());

  const { data, error } = await listActiveTricyclesForAdmin();
  assert.equal(error, null);
  assert.deepEqual(data, [
    { driverId: 'drv2', driverFullName: 'Ariel Cabahug', plateNo: 'GSC-2214', tripStatus: 'idle', seatsTaken: 0, maxSeats: 4 },
    { driverId: 'drv1', driverFullName: 'Ronnie Bautista', plateNo: 'GSC-1187', tripStatus: 'active', seatsTaken: 3, maxSeats: 6 },
  ]);
});

test('listActiveTricyclesForAdmin returns an empty list without further queries when no one is on duty', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'driver_profiles') return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listActiveTricyclesForAdmin();
  assert.deepEqual(data, []);
  assert.equal(error, null);
});

test('listActiveTricyclesForAdmin returns { data: [], error } when the driver_profiles query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ eq: async () => ({ data: null, error: { message: 'connection refused' } }) }) }),
  } as any);

  const { data, error } = await listActiveTricyclesForAdmin();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('listActiveTricyclesForAdmin degrades a driver with no tricycle row to "—" plate and 0 max seats instead of dropping them', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'driver_profiles') return { select: () => ({ eq: async () => ({ data: [{ user_id: 'drv1' }], error: null }) }) };
      if (table === 'users') return { select: () => ({ in: async () => ({ data: [{ id: 'drv1', full_name: 'Ronnie Bautista' }], error: null }) }) };
      if (table === 'tricycles') return { select: () => ({ in: () => ({ eq: async () => ({ data: [], error: null }) }) }) };
      if (table === 'trips') return { select: () => ({ in: () => ({ eq: async () => ({ data: [], error: null }) }) }) };
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listActiveTricyclesForAdmin();
  assert.equal(error, null);
  assert.deepEqual(data, [{ driverId: 'drv1', driverFullName: 'Ronnie Bautista', plateNo: '—', tripStatus: 'idle', seatsTaken: 0, maxSeats: 0 }]);
});
