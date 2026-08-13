import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { getAdminDashboardStats } from '../src/admin/dashboard.ts';

function countQuery(count: number) {
  return {
    eq: async () => ({ count, error: null }),
    in: async () => ({ count, error: null }),
  };
}

test('getAdminDashboardStats issues the right table/filter per count and maps them', async () => {
  const captured: { table: string; column?: string; value?: unknown }[] = [];

  __setSupabaseClientForTests({
    from: (table: string) => ({
      select: (_columns: string, _opts: unknown) => ({
        eq: async (column: string, value: unknown) => {
          captured.push({ table, column, value });
          if (table === 'users') return { count: 12, error: null };
          if (table === 'trips') return { count: 3, error: null };
          if (table === 'driver_profiles') return { count: 5, error: null };
          throw new Error(`unexpected eq() on ${table}`);
        },
        in: async (column: string, value: unknown) => {
          captured.push({ table, column, value });
          return { count: 7, error: null };
        },
      }),
    }),
  } as any);

  const { data, error } = await getAdminDashboardStats();

  assert.equal(error, null);
  assert.deepEqual(data, { totalDrivers: 12, activeRides: 3, pendingVerifications: 5, openComplaints: 7 });

  assert.deepEqual(captured.find((c) => c.table === 'users'), { table: 'users', column: 'role', value: 'driver' });
  assert.deepEqual(captured.find((c) => c.table === 'trips'), { table: 'trips', column: 'status', value: 'active' });
  assert.deepEqual(captured.find((c) => c.table === 'driver_profiles'), {
    table: 'driver_profiles',
    column: 'verification_status',
    value: 'pending',
  });
  assert.deepEqual(captured.find((c) => c.table === 'complaints'), {
    table: 'complaints',
    column: 'status',
    value: ['open', 'under_review', 'escalated', 'mediation_scheduled'],
  });
});

test('getAdminDashboardStats returns { data: null, error } when any one count query errors', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => ({
      select: () => ({
        eq: async () => (table === 'trips' ? { count: null, error: { message: 'connection refused' } } : { count: 1, error: null }),
        in: async () => ({ count: 1, error: null }),
      }),
    }),
  } as any);

  const { data, error } = await getAdminDashboardStats();
  assert.equal(data, null);
  assert.equal(error, 'connection refused');
});
