import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { getAdminDashboardStats, getRidesPerDay, getTripStatusBreakdown, listExpiringFranchises, listOverdueComplaints, listRecentTripActivity } from '../src/admin/dashboard.ts';

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

test('listOverdueComplaints maps view rows and resolves both name columns', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'v_overdue_complaints') {
        return {
          select: async () => ({
            data: [
              {
                id: 'c1',
                submitted_by: 'u-passenger',
                against_user_id: 'u-driver',
                category: 'fare',
                status: 'open',
                created_at: '2026-08-01T00:00:00.000Z',
                business_days_elapsed: 5,
              },
            ],
            error: null,
          }),
        };
      }
      if (table === 'users') {
        return {
          select: () => ({
            in: async () => ({
              data: [
                { id: 'u-passenger', full_name: 'Maria Clara' },
                { id: 'u-driver', full_name: 'Juan Dela Cruz' },
              ],
              error: null,
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listOverdueComplaints();

  assert.equal(error, null);
  assert.deepEqual(data, [
    {
      id: 'c1',
      submittedByName: 'Maria Clara',
      againstUserName: 'Juan Dela Cruz',
      category: 'fare',
      status: 'open',
      createdAt: '2026-08-01T00:00:00.000Z',
      businessDaysElapsed: 5,
    },
  ]);
});

test('listOverdueComplaints degrades a name to null when the user lookup misses it', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'v_overdue_complaints') {
        return {
          select: async () => ({
            data: [
              {
                id: 'c1',
                submitted_by: 'u-passenger',
                against_user_id: 'u-deleted',
                category: 'conduct',
                status: 'under_review',
                created_at: '2026-08-01T00:00:00.000Z',
                business_days_elapsed: 4,
              },
            ],
            error: null,
          }),
        };
      }
      if (table === 'users') {
        // u-deleted no longer exists — only u-passenger comes back.
        return { select: () => ({ in: async () => ({ data: [{ id: 'u-passenger', full_name: 'Maria Clara' }], error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listOverdueComplaints();
  assert.equal(error, null);
  assert.equal(data[0].submittedByName, 'Maria Clara');
  assert.equal(data[0].againstUserName, null);
});

test('listOverdueComplaints returns { data: [], error } when the view query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: async () => ({ data: null, error: { message: 'connection refused' } }) }),
  } as any);

  const { data, error } = await listOverdueComplaints();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('listExpiringFranchises maps view rows and resolves driverName', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'v_expiring_franchises') {
        return {
          select: async () => ({
            data: [
              {
                tricycle_id: 't1',
                driver_id: 'u-driver',
                plate_no: 'GSC-1234',
                mtop_no: 'MTOP-001',
                mtop_expiry_date: '2026-09-01',
                days_until_expiry: 18,
              },
            ],
            error: null,
          }),
        };
      }
      if (table === 'users') {
        return { select: () => ({ in: async () => ({ data: [{ id: 'u-driver', full_name: 'Juan Dela Cruz' }], error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listExpiringFranchises();
  assert.equal(error, null);
  assert.deepEqual(data, [
    {
      tricycleId: 't1',
      driverId: 'u-driver',
      driverName: 'Juan Dela Cruz',
      plateNo: 'GSC-1234',
      mtopNo: 'MTOP-001',
      mtopExpiryDate: '2026-09-01',
      daysUntilExpiry: 18,
    },
  ]);
});

test('listExpiringFranchises returns { data: [], error } when the view query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: async () => ({ data: null, error: { message: 'connection refused' } }) }),
  } as any);

  const { data, error } = await listExpiringFranchises();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

function rideRequestsTable(rows: unknown[], captureLimit?: (n: number) => void) {
  return {
    select: () => ({
      not: () => ({
        order: () => ({
          limit: async (n: number) => {
            captureLimit?.(n);
            return { data: rows, error: null };
          },
        }),
      }),
    }),
  };
}

function tripsTable(rows: unknown[]) {
  return { select: () => ({ in: async () => ({ data: rows, error: null }) }) };
}

function usersTable(rows: unknown[]) {
  return { select: () => ({ in: async () => ({ data: rows, error: null }) }) };
}

test('listRecentTripActivity joins ride_requests to their trip, resolves both names, and respects the limit arg', async () => {
  let capturedLimit: number | null = null;

  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'ride_requests') {
        return rideRequestsTable(
          [
            { id: 'rr1', passenger_id: 'u-passenger1', final_fare: 42, trip_id: 'trip1' },
            { id: 'rr2', passenger_id: 'u-deleted-passenger', final_fare: null, trip_id: 'trip2' },
          ],
          (n) => (capturedLimit = n),
        );
      }
      if (table === 'trips') {
        return tripsTable([
          { id: 'trip1', status: 'active', updated_at: '2026-08-14T00:00:00.000Z', driver_id: 'u-driver1' },
          { id: 'trip2', status: 'completed', updated_at: '2026-08-13T23:50:00.000Z', driver_id: 'u-deleted-driver' },
        ]);
      }
      if (table === 'users') {
        // u-deleted-driver / u-deleted-passenger no longer exist — only the two live users come back.
        return usersTable([
          { id: 'u-driver1', full_name: 'Ronnie Bautista' },
          { id: 'u-passenger1', full_name: 'Maria Clara' },
        ]);
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listRecentTripActivity(20);

  assert.equal(error, null);
  assert.equal(capturedLimit, 80); // over-fetches 4x the requested limit
  assert.deepEqual(data, [
    { id: 'rr1', driverName: 'Ronnie Bautista', passengerName: 'Maria Clara', status: 'active', fare: 42, updatedAt: '2026-08-14T00:00:00.000Z' },
    { id: 'rr2', driverName: null, passengerName: null, status: 'completed', fare: null, updatedAt: '2026-08-13T23:50:00.000Z' },
  ]);
});

test('listRecentTripActivity sorts by the trip\'s recency, not the ride_request fetch order', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'ride_requests') {
        return rideRequestsTable([
          { id: 'rr-older-trip', passenger_id: 'p1', final_fare: 10, trip_id: 'trip-old' },
          { id: 'rr-newer-trip', passenger_id: 'p2', final_fare: 20, trip_id: 'trip-new' },
        ]);
      }
      if (table === 'trips') {
        return tripsTable([
          { id: 'trip-old', status: 'completed', updated_at: '2026-08-01T00:00:00.000Z', driver_id: 'd1' },
          { id: 'trip-new', status: 'completed', updated_at: '2026-08-14T00:00:00.000Z', driver_id: 'd2' },
        ]);
      }
      return usersTable([]);
    },
  } as any);

  const { data, error } = await listRecentTripActivity();
  assert.equal(error, null);
  assert.deepEqual(data.map((r) => r.id), ['rr-newer-trip', 'rr-older-trip']);
});

test('listRecentTripActivity defaults the limit to 10 (over-fetches 40 ride_requests)', async () => {
  let capturedLimit: number | null = null;
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'ride_requests') return rideRequestsTable([], (n) => (capturedLimit = n));
      return usersTable([]);
    },
  } as any);

  await listRecentTripActivity();
  assert.equal(capturedLimit, 40);
});

test('listRecentTripActivity returns { data: [], error } when the ride_requests query fails', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'ride_requests') {
        return { select: () => ({ not: () => ({ order: () => ({ limit: async () => ({ data: null, error: { message: 'connection refused' } }) }) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listRecentTripActivity();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('listRecentTripActivity returns { data: [], error } when the trips query fails', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'ride_requests') return rideRequestsTable([{ id: 'rr1', passenger_id: 'p1', final_fare: 10, trip_id: 'trip1' }]);
      if (table === 'trips') return { select: () => ({ in: async () => ({ data: null, error: { message: 'connection refused' } }) }) };
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listRecentTripActivity();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('getRidesPerDay groups completed ride_requests into calendar-day buckets, oldest first', async () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0).toISOString();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 9, 0, 0).toISOString();

  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'ride_requests') {
        return {
          select: () => ({
            eq: () => ({
              gte: async () => ({
                data: [{ requested_at: yesterday }, { requested_at: today }, { requested_at: today }],
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await getRidesPerDay();
  assert.equal(error, null);
  assert.equal(data.length, 7);
  assert.equal(data[5].count, 1); // yesterday
  assert.equal(data[6].count, 2); // today
});

test('getRidesPerDay returns 7 zero-count days (not an error) when nothing happened this week', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ eq: () => ({ gte: async () => ({ data: [], error: null }) }) }) }),
  } as any);

  const { data, error } = await getRidesPerDay();
  assert.equal(error, null);
  assert.equal(data.length, 7);
  assert.ok(data.every((d) => d.count === 0));
});

test('getRidesPerDay returns { data: [], error } when the query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ eq: () => ({ gte: async () => ({ data: null, error: { message: 'connection refused' } }) }) }) }),
  } as any);

  const { data, error } = await getRidesPerDay();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('getTripStatusBreakdown issues one count query per TripStatus and maps them', async () => {
  const captured: { column: string; value: unknown }[] = [];

  __setSupabaseClientForTests({
    from: (table: string) => {
      assert.equal(table, 'trips');
      return {
        select: () => ({
          eq: async (column: string, value: unknown) => {
            captured.push({ column, value });
            const counts: Record<string, number> = { forming: 2, active: 5, completed: 421, cancelled: 34 };
            return { count: counts[value as string], error: null };
          },
        }),
      };
    },
  } as any);

  const { data, error } = await getTripStatusBreakdown();
  assert.equal(error, null);
  assert.deepEqual(data, [
    { status: 'forming', count: 2 },
    { status: 'active', count: 5 },
    { status: 'completed', count: 421 },
    { status: 'cancelled', count: 34 },
  ]);
  assert.ok(captured.every((c) => c.column === 'status'));
});

test('getTripStatusBreakdown returns { data: [], error } when any one count query errors', async () => {
  __setSupabaseClientForTests({
    from: () => ({
      select: () => ({
        eq: async (_column: string, value: unknown) =>
          value === 'active' ? { count: null, error: { message: 'connection refused' } } : { count: 1, error: null },
      }),
    }),
  } as any);

  const { data, error } = await getTripStatusBreakdown();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});
