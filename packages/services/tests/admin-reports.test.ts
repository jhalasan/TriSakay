import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { getAdminReportSummary, getPeakHourHistogram, getRidesRevenueOverTime, listTransactionsForAdmin } from '../src/admin/reports.ts';

/**
 * R9 (existing-system audit): the peak-hour/day bucketing is now pinned to
 * Asia/Manila regardless of which timezone the test runner's machine is in
 * (CI is typically UTC) — so fixtures must be built as the UTC instant that
 * corresponds to a given Manila wall-clock hour, not the runner's own local
 * time. Manila has no DST (fixed UTC+8 year-round), so this is a plain
 * 8-hour offset from "today in Manila", not a real timezone conversion.
 */
function todayInManila(): { year: number; month: number; day: number } {
  const [year, month, day] = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }).split('-').map(Number);
  return { year, month, day };
}

function manilaTimeIso(hour: number, minute = 0, dayOffset = 0): string {
  const { year, month, day } = todayInManila();
  return new Date(Date.UTC(year, month - 1, day + dayOffset, hour - 8, minute, 0, 0)).toISOString();
}

function todayAt(hour: number, minute = 0): string {
  return manilaTimeIso(hour, minute);
}

test('getAdminReportSummary sums paid revenue, counts completed rides, and picks the busiest 2-hour window', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'ride_requests') {
        return {
          select: () => ({
            eq: () => ({
              gte: async () => ({
                data: [{ requested_at: todayAt(6, 15) }, { requested_at: todayAt(7, 40) }, { requested_at: todayAt(14, 0) }],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'transactions') {
        return {
          select: () => ({
            eq: () => ({ gte: async () => ({ data: [{ amount: '18.00' }, { amount: '24.50' }], error: null }) }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await getAdminReportSummary('2026-08-01T00:00:00.000Z');
  assert.equal(error, null);
  assert.equal(data.totalRides, 3);
  assert.equal(data.totalRevenue, 42.5);
  assert.equal(Math.round(data.averageFare * 100) / 100, 14.17);
  // Two of three rides fall in the 6:00 AM–8:00 AM Manila window (6:15, 7:40).
  assert.equal(data.peakHourLabel, '6:00 AM–8:00 AM');
});

test('getAdminReportSummary applies an upper bound too when untilIso is given (the previous-period comparison window)', async () => {
  let capturedRideBound: string | undefined;
  let capturedTxnBound: string | undefined;

  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'ride_requests') {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lt: async (_col: string, bound: string) => {
                  capturedRideBound = bound;
                  return { data: [{ requested_at: todayAt(9, 0) }], error: null };
                },
              }),
            }),
          }),
        };
      }
      if (table === 'transactions') {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lt: async (_col: string, bound: string) => {
                  capturedTxnBound = bound;
                  return { data: [{ amount: '30.00' }], error: null };
                },
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await getAdminReportSummary('2026-07-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z');
  assert.equal(error, null);
  assert.equal(data.totalRides, 1);
  assert.equal(data.totalRevenue, 30);
  assert.equal(capturedRideBound, '2026-08-01T00:00:00.000Z');
  assert.equal(capturedTxnBound, '2026-08-01T00:00:00.000Z');
});

test('getAdminReportSummary degrades to a 0/— summary (not an error) when there are no rides in range', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'ride_requests') return { select: () => ({ eq: () => ({ gte: async () => ({ data: [], error: null }) }) }) };
      if (table === 'transactions') return { select: () => ({ eq: () => ({ gte: async () => ({ data: [], error: null }) }) }) };
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await getAdminReportSummary('2026-08-01T00:00:00.000Z');
  assert.equal(error, null);
  assert.deepEqual(data, { totalRides: 0, totalRevenue: 0, averageFare: 0, peakHourLabel: '—' });
});

test('getAdminReportSummary returns an error summary when the rides query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ eq: () => ({ gte: async () => ({ data: null, error: { message: 'connection refused' } }) }) }) }),
  } as any);

  const { error } = await getAdminReportSummary('2026-08-01T00:00:00.000Z');
  assert.equal(error, 'connection refused');
});

test('listTransactionsForAdmin resolves passenger + driver names through the ride_requests -> trips -> users chain', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'transactions') {
        return {
          select: () => ({
            gte: () => ({
              order: () => ({
                limit: async () => ({
                  data: [{ id: 'txn1', ride_request_id: 'rr1', amount: '18.00', method: 'cash', status: 'paid', created_at: '2026-08-05T07:40:00.000Z' }],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'ride_requests') {
        return { select: () => ({ in: async () => ({ data: [{ id: 'rr1', passenger_id: 'p1', trip_id: 'trip1' }], error: null }) }) };
      }
      if (table === 'trips') {
        return { select: () => ({ in: async () => ({ data: [{ id: 'trip1', driver_id: 'd1' }], error: null }) }) };
      }
      if (table === 'users') {
        return {
          select: () => ({
            in: async () => ({
              data: [
                { id: 'p1', full_name: 'Maria Fe Santos' },
                { id: 'd1', full_name: 'Ronnie Bautista' },
              ],
              error: null,
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error, truncated } = await listTransactionsForAdmin('2026-08-01T00:00:00.000Z');
  assert.equal(error, null);
  assert.equal(truncated, false);
  assert.deepEqual(data, [
    {
      id: 'txn1',
      rideRequestId: 'rr1',
      passengerName: 'Maria Fe Santos',
      driverName: 'Ronnie Bautista',
      amount: 18,
      method: 'cash',
      status: 'paid',
      createdAt: '2026-08-05T07:40:00.000Z',
    },
  ]);
});

test('listTransactionsForAdmin degrades driverName to "—" for a ride cancelled before a trip existed, without dropping the transaction', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'transactions') {
        return {
          select: () => ({
            gte: () => ({
              order: () => ({
                limit: async () => ({
                  data: [{ id: 'txn1', ride_request_id: 'rr1', amount: '18.00', method: 'cash', status: 'refunded', created_at: '2026-08-05T07:40:00.000Z' }],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'ride_requests') {
        return { select: () => ({ in: async () => ({ data: [{ id: 'rr1', passenger_id: 'p1', trip_id: null }], error: null }) }) };
      }
      if (table === 'users') {
        return { select: () => ({ in: async () => ({ data: [{ id: 'p1', full_name: 'Maria Fe Santos' }], error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listTransactionsForAdmin('2026-08-01T00:00:00.000Z');
  assert.equal(error, null);
  assert.equal(data[0].driverName, '—');
});

test('listTransactionsForAdmin returns an empty list without further queries when there are no transactions in range', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'transactions') return { select: () => ({ gte: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }) };
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error, truncated } = await listTransactionsForAdmin('2026-08-01T00:00:00.000Z');
  assert.deepEqual(data, []);
  assert.equal(error, null);
  assert.equal(truncated, false);
});

test('listTransactionsForAdmin reports truncated when the row cap is hit', async () => {
  const cappedRow = { id: 'txn1', ride_request_id: 'rr1', amount: '18.00', method: 'cash' as const, status: 'paid' as const, created_at: '2026-08-05T07:40:00.000Z' };
  const capped = Array.from({ length: 2000 }, (_, i) => ({ ...cappedRow, id: `txn${i}` }));

  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'transactions') {
        return { select: () => ({ gte: () => ({ order: () => ({ limit: async () => ({ data: capped, error: null }) }) }) }) };
      }
      if (table === 'ride_requests') {
        return { select: () => ({ in: async () => ({ data: [{ id: 'rr1', passenger_id: 'p1', trip_id: null }], error: null }) }) };
      }
      if (table === 'users') {
        return { select: () => ({ in: async () => ({ data: [{ id: 'p1', full_name: 'Maria Fe Santos' }], error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error, truncated } = await listTransactionsForAdmin('2026-08-01T00:00:00.000Z');
  assert.equal(error, null);
  assert.equal(data.length, 2000);
  assert.equal(truncated, true);
});

test('getPeakHourHistogram returns 12 two-hour buckets and labels each one', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'ride_requests') {
        return {
          select: () => ({
            eq: () => ({
              gte: async () => ({
                data: [{ requested_at: todayAt(6, 15) }, { requested_at: todayAt(7, 40) }, { requested_at: todayAt(14, 0) }],
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await getPeakHourHistogram('2026-08-01T00:00:00.000Z');
  assert.equal(error, null);
  assert.equal(data.length, 12);
  assert.deepEqual(data[3], { hourLabel: '6:00 AM–8:00 AM', count: 2 });
  assert.deepEqual(data[7], { hourLabel: '2:00 PM–4:00 PM', count: 1 });
  assert.equal(data.reduce((sum, b) => sum + b.count, 0), 3);
});

test('getPeakHourHistogram returns { data: [], error } when the query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ eq: () => ({ gte: async () => ({ data: null, error: { message: 'connection refused' } }) }) }) }),
  } as any);

  const { data, error } = await getPeakHourHistogram('2026-08-01T00:00:00.000Z');
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('getRidesRevenueOverTime buckets completed rides and paid revenue by Manila calendar day', async () => {
  const today = manilaTimeIso(9, 0);
  const yesterday = manilaTimeIso(9, 0, -1);
  const since = manilaTimeIso(0, 0, -1);

  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'ride_requests') {
        return {
          select: () => ({
            eq: () => ({ gte: async () => ({ data: [{ requested_at: yesterday }, { requested_at: today }], error: null }) }),
          }),
        };
      }
      if (table === 'transactions') {
        return {
          select: () => ({
            eq: () => ({ gte: async () => ({ data: [{ amount: '18.00', created_at: yesterday }, { amount: '24.50', created_at: today }], error: null }) }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await getRidesRevenueOverTime(since);
  assert.equal(error, null);
  assert.equal(data.length, 2);
  assert.equal(data[0].rides, 1);
  assert.equal(data[0].revenue, 18);
  assert.equal(data[1].rides, 1);
  assert.equal(data[1].revenue, 24.5);
});

test('getRidesRevenueOverTime returns { data: [], error } when the rides query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ eq: () => ({ gte: async () => ({ data: null, error: { message: 'connection refused' } }) }) }) }),
  } as any);

  const { data, error } = await getRidesRevenueOverTime('2026-08-01T00:00:00.000Z');
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});
