import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { getAdminReportSummary, listTransactionsForAdmin } from '../src/admin/reports.ts';

/**
 * The peak-hour bucketing reads Date#getHours() (local wall-clock time,
 * deliberately — see admin/reports.ts's doc comment: this mirrors the rest
 * of the app rendering everything in the PSO's own local time). Building
 * fixtures via new Date(y, m, d, hour) instead of a hardcoded UTC ISO
 * string keeps the expected bucket correct regardless of which timezone
 * this test suite happens to run in.
 */
function todayAt(hour: number, minute = 0): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0).toISOString();
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
  // Two of three rides fall in the 6:00 AM–8:00 AM UTC window (6:15, 7:40).
  assert.equal(data.peakHourLabel, '6:00 AM–8:00 AM');
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
              order: async () => ({
                data: [{ id: 'txn1', ride_request_id: 'rr1', amount: '18.00', method: 'cash', status: 'paid', created_at: '2026-08-05T07:40:00.000Z' }],
                error: null,
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

  const { data, error } = await listTransactionsForAdmin('2026-08-01T00:00:00.000Z');
  assert.equal(error, null);
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
              order: async () => ({
                data: [{ id: 'txn1', ride_request_id: 'rr1', amount: '18.00', method: 'cash', status: 'refunded', created_at: '2026-08-05T07:40:00.000Z' }],
                error: null,
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
      if (table === 'transactions') return { select: () => ({ gte: () => ({ order: async () => ({ data: [], error: null }) }) }) };
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listTransactionsForAdmin('2026-08-01T00:00:00.000Z');
  assert.deepEqual(data, []);
  assert.equal(error, null);
});
