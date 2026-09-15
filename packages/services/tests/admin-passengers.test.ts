import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { listPassengersForAdmin } from '../src/admin/passengers.ts';

test('listPassengersForAdmin merges users + completed ride counts + approved discounts', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [
                  { id: 'p1', first_name: 'Maria', last_name: 'Fe Santos', full_name: 'Maria Fe Santos', contact_no: '0917-000-0002', email: 'maria@example.com', status: 'active', created_at: '2026-01-01T00:00:00.000Z' },
                  { id: 'p2', first_name: 'Juan', last_name: 'Dela Cruz', full_name: 'Juan Dela Cruz', contact_no: null, email: 'juan@example.com', status: 'active', created_at: '2026-02-01T00:00:00.000Z' },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'passenger_discounts') {
        return {
          select: () => ({
            in: () => ({
              order: async () => ({ data: [{ passenger_id: 'p1', category: 'senior_citizen', status: 'approved' }], error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    // P1-22 (2026-09-15 launch audit): ride counts are now a real
    // server-side aggregate (get_passenger_completed_ride_counts), not a
    // fetched-and-tallied row-per-ride query — p1 has 3 completed rides,
    // p2 has none (GROUP BY naturally omits a zero-count passenger).
    rpc: async (fn: string, args: any) => {
      if (fn === 'get_passenger_completed_ride_counts') {
        assert.deepEqual(args, { p_passenger_ids: ['p1', 'p2'] });
        return { data: [{ passenger_id: 'p1', ride_count: 3 }], error: null };
      }
      throw new Error(`unexpected rpc ${fn}`);
    },
  } as any);

  const { data, error } = await listPassengersForAdmin();

  assert.equal(error, null);
  assert.deepEqual(data, [
    {
      id: 'p1',
      firstName: 'Maria',
      lastName: 'Fe Santos',
      fullName: 'Maria Fe Santos',
      contactNo: '0917-000-0002',
      email: 'maria@example.com',
      accountStatus: 'active',
      totalRides: 3,
      discount: { category: 'senior_citizen', status: 'approved' },
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'p2',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      fullName: 'Juan Dela Cruz',
      contactNo: null,
      email: 'juan@example.com',
      accountStatus: 'active',
      totalRides: 0,
      discount: null,
      createdAt: '2026-02-01T00:00:00.000Z',
    },
  ]);
});

test('listPassengersForAdmin keeps only the most recently submitted discount per passenger', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'users') {
        return { select: () => ({ eq: () => ({ order: async () => ({ data: [{ id: 'p1', full_name: 'X', contact_no: null, email: 'x@example.com', status: 'active', created_at: 'now' }], error: null }) }) }) };
      }
      if (table === 'passenger_discounts') {
        // Query is ordered submitted_at desc, so the rejected row (resubmission) comes first.
        return {
          select: () => ({
            in: () => ({
              order: async () => ({
                data: [
                  { passenger_id: 'p1', category: 'pwd', status: 'pending' },
                  { passenger_id: 'p1', category: 'student', status: 'rejected' },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: async () => ({ data: [], error: null }),
  } as any);

  const { data, error } = await listPassengersForAdmin();
  assert.equal(error, null);
  assert.deepEqual(data[0].discount, { category: 'pwd', status: 'pending' });
});

test('listPassengersForAdmin returns { data: [], error } when the ride-count RPC fails', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'users') {
        return { select: () => ({ eq: () => ({ order: async () => ({ data: [{ id: 'p1', full_name: 'X', contact_no: null, email: 'x@example.com', status: 'active', created_at: 'now' }], error: null }) }) }) };
      }
      if (table === 'passenger_discounts') return { select: () => ({ in: () => ({ order: async () => ({ data: [], error: null }) }) }) };
      throw new Error(`unexpected table ${table}`);
    },
    rpc: async () => ({ data: null, error: { message: 'connection refused' } }),
  } as any);

  const { data, error } = await listPassengersForAdmin();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('listPassengersForAdmin returns { data: [], error } when the passenger_discounts query fails', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'users') {
        return { select: () => ({ eq: () => ({ order: async () => ({ data: [{ id: 'p1', full_name: 'X', contact_no: null, email: 'x@example.com', status: 'active', created_at: 'now' }], error: null }) }) }) };
      }
      if (table === 'passenger_discounts') return { select: () => ({ in: () => ({ order: async () => ({ data: null, error: { message: 'connection refused' } }) }) }) };
      throw new Error(`unexpected table ${table}`);
    },
    rpc: async () => ({ data: [], error: null }),
  } as any);

  const { data, error } = await listPassengersForAdmin();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('listPassengersForAdmin returns { data: [], error } when the users query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: null, error: { message: 'connection refused' } }) }) }) }),
  } as any);

  const { data, error } = await listPassengersForAdmin();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});
