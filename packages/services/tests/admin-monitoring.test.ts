import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { getActiveTricycleLocations, listActiveTricyclesForAdmin } from '../src/admin/monitoring.ts';

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

test('getActiveTricycleLocations rounds coordinates to 2 decimals and groups drivers sharing a grid cell', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'driver_profiles') {
        return {
          select: () => ({
            eq: async () => ({
              data: [
                { user_id: 'drv1', current_lat: 6.116243, current_lng: 125.171738 },
                { user_id: 'drv2', current_lat: 6.116291, current_lng: 125.171701 }, // rounds to the same cell as drv1
                { user_id: 'drv3', current_lat: 6.204, current_lng: 125.09 },
                { user_id: 'drv4', current_lat: null, current_lng: null }, // dropped — no fix
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'users') {
        return {
          select: () => ({
            in: async () => ({
              data: [
                { id: 'drv1', full_name: 'Ronnie Bautista' },
                { id: 'drv2', full_name: 'Ariel Cabahug' },
                { id: 'drv3', full_name: 'Juan Dela Cruz' },
              ],
              error: null,
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await getActiveTricycleLocations();
  assert.equal(error, null);
  assert.equal(data.length, 2);

  const shared = data.find((c) => c.count === 2)!;
  assert.equal(shared.lat, 6.12);
  assert.equal(shared.lng, 125.17);
  assert.deepEqual([...shared.driverNames].sort(), ['Ariel Cabahug', 'Ronnie Bautista']);

  const solo = data.find((c) => c.count === 1)!;
  assert.equal(solo.lat, 6.2);
  assert.equal(solo.lng, 125.09);
  assert.deepEqual(solo.driverNames, ['Juan Dela Cruz']);
});

test('getActiveTricycleLocations returns an empty list without further queries when no one is on duty', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'driver_profiles') return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await getActiveTricycleLocations();
  assert.deepEqual(data, []);
  assert.equal(error, null);
});

test('getActiveTricycleLocations returns { data: [], error } when the driver_profiles query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ eq: async () => ({ data: null, error: { message: 'connection refused' } }) }) }),
  } as any);

  const { data, error } = await getActiveTricycleLocations();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});
