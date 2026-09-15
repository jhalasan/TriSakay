import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { listDriversForAdmin } from '../src/admin/drivers.ts';

test('listDriversForAdmin merges users + driver_profiles + tricycles by id', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [
                  { id: 'd1', first_name: 'Ronnie', last_name: 'Bautista', full_name: 'Ronnie Bautista', contact_no: '0917-000-0001', email: 'ronnie@example.com', status: 'active', created_at: '2026-01-01T00:00:00.000Z' },
                  { id: 'd2', first_name: 'Ariel', last_name: 'Cabahug', full_name: 'Ariel Cabahug', contact_no: null, email: 'ariel@example.com', status: 'active', created_at: '2026-02-01T00:00:00.000Z' },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'driver_profiles') {
        return {
          select: () => ({
            in: async () => ({
              data: [{ user_id: 'd1', verification_status: 'approved', rating_avg: '4.80', rating_count: 132 }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'tricycles') {
        return {
          select: () => ({
            in: async () => ({
              data: [{ driver_id: 'd1', plate_no: 'GSC-4521', cluster: 'melting_pot' }],
              error: null,
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    // P1-22 (2026-09-15 launch audit): trip counts are now a real
    // server-side aggregate (get_driver_trip_counts), not a fetched-and-
    // tallied row-per-trip query — d1 has 3 trips, d2 has none (GROUP BY
    // naturally omits a zero-count driver, matching live behavior).
    rpc: async (fn: string, args: any) => {
      if (fn === 'get_driver_trip_counts') {
        assert.deepEqual(args, { p_driver_ids: ['d1', 'd2'] });
        return { data: [{ driver_id: 'd1', trip_count: 3 }], error: null };
      }
      throw new Error(`unexpected rpc ${fn}`);
    },
  } as any);

  const { data, error } = await listDriversForAdmin();

  assert.equal(error, null);
  assert.deepEqual(data, [
    {
      id: 'd1',
      firstName: 'Ronnie',
      lastName: 'Bautista',
      fullName: 'Ronnie Bautista',
      contactNo: '0917-000-0001',
      email: 'ronnie@example.com',
      accountStatus: 'active',
      verificationStatus: 'approved',
      ratingAvg: 4.8,
      ratingCount: 132,
      plateNo: 'GSC-4521',
      cluster: 'melting_pot',
      tripCount: 3,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'd2',
      firstName: 'Ariel',
      lastName: 'Cabahug',
      fullName: 'Ariel Cabahug',
      contactNo: null,
      email: 'ariel@example.com',
      accountStatus: 'active',
      verificationStatus: 'unsubmitted',
      ratingAvg: 0,
      ratingCount: 0,
      plateNo: null,
      cluster: null,
      tripCount: 0,
      createdAt: '2026-02-01T00:00:00.000Z',
    },
  ]);
});

test('listDriversForAdmin returns an empty array without querying profiles/tricycles when there are no drivers', async () => {
  let profilesQueried = false;
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'users') return { select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) };
      profilesQueried = true;
      throw new Error(`should not query ${table}`);
    },
  } as any);

  const { data, error } = await listDriversForAdmin();
  assert.deepEqual(data, []);
  assert.equal(error, null);
  assert.equal(profilesQueried, false);
});

test('listDriversForAdmin returns { data: [], error } when the users query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: null, error: { message: 'connection refused' } }) }) }) }),
  } as any);

  const { data, error } = await listDriversForAdmin();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('listDriversForAdmin returns { data: [], error } when the tricycles query fails', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'users') {
        return { select: () => ({ eq: () => ({ order: async () => ({ data: [{ id: 'd1', full_name: 'X', contact_no: null, email: 'x@example.com', status: 'active', created_at: 'now' }], error: null }) }) }) };
      }
      if (table === 'driver_profiles') return { select: () => ({ in: async () => ({ data: [], error: null }) }) };
      if (table === 'tricycles') return { select: () => ({ in: async () => ({ data: null, error: { message: 'connection refused' } }) }) };
      throw new Error(`unexpected table ${table}`);
    },
    rpc: async () => ({ data: [], error: null }),
  } as any);

  const { data, error } = await listDriversForAdmin();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('listDriversForAdmin returns { data: [], error } when the trip-count RPC fails', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'users') {
        return { select: () => ({ eq: () => ({ order: async () => ({ data: [{ id: 'd1', full_name: 'X', contact_no: null, email: 'x@example.com', status: 'active', created_at: 'now' }], error: null }) }) }) };
      }
      if (table === 'driver_profiles') return { select: () => ({ in: async () => ({ data: [], error: null }) }) };
      if (table === 'tricycles') return { select: () => ({ in: async () => ({ data: [], error: null }) }) };
      throw new Error(`unexpected table ${table}`);
    },
    rpc: async () => ({ data: null, error: { message: 'connection refused' } }),
  } as any);

  const { data, error } = await listDriversForAdmin();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});
