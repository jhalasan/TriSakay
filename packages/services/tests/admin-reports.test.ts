import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { getAdminReportSummary, getPeakHourHistogram, getRidesRevenueOverTime, listTransactionsForAdmin } from '../src/admin/reports.ts';

type RpcCall = { fn: string; args: unknown };

function fakeRpc(handlers: Record<string, (args: any) => { data: unknown; error: { message: string } | null }>, calls: RpcCall[] = []) {
  __setSupabaseClientForTests({
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      const handler = handlers[fn];
      if (!handler) throw new Error(`unexpected rpc ${fn}`);
      return handler(args);
    },
  } as any);
  return calls;
}

const PEAK_6_TO_8 = Array.from({ length: 12 }, (_, i) => ({ bucket_index: i, bucket_count: i === 3 ? 2 : i === 7 ? 1 : 0 }));

test('getAdminReportSummary reads the completed-ride totals from the database and names the busiest 2-hour window', async () => {
  const calls = fakeRpc({
    admin_report_summary: () => ({ data: [{ total_rides: 30, total_revenue: '630.00', average_fare: '21.00' }], error: null }),
    get_peak_hour_histogram: () => ({ data: PEAK_6_TO_8, error: null }),
  });

  const { data, error } = await getAdminReportSummary('2026-08-01T00:00:00.000Z');

  assert.equal(error, null);
  assert.equal(data.totalRides, 30);
  assert.equal(data.totalRevenue, 630);
  // The average comes from the same completed rides as the revenue, so 630 / 30.
  assert.equal(data.averageFare, 21);
  // Bucket 3 is 6:00–8:00 AM and holds the most rides.
  assert.equal(data.peakHourLabel, '6:00 AM–8:00 AM');
  assert.deepEqual(calls.find((c) => c.fn === 'admin_report_summary')?.args, { p_since: '2026-08-01T00:00:00.000Z' });
});

test('getAdminReportSummary passes the upper bound and skips the peak-hour call for the previous-period window', async () => {
  const calls = fakeRpc({
    admin_report_summary: () => ({ data: [{ total_rides: 4, total_revenue: '60.00', average_fare: '15.00' }], error: null }),
  });

  const { data, error } = await getAdminReportSummary('2026-07-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z');

  assert.equal(error, null);
  assert.equal(data.totalRides, 4);
  assert.equal(data.peakHourLabel, '—');
  assert.deepEqual(calls.map((c) => c.fn), ['admin_report_summary']);
  assert.deepEqual(calls[0].args, { p_since: '2026-07-01T00:00:00.000Z', p_until: '2026-08-01T00:00:00.000Z' });
});

test('getAdminReportSummary degrades to a 0/— summary (not an error) when there are no completed rides', async () => {
  fakeRpc({
    admin_report_summary: () => ({ data: [{ total_rides: 0, total_revenue: '0', average_fare: '0' }], error: null }),
    get_peak_hour_histogram: () => ({ data: PEAK_6_TO_8.map((b) => ({ ...b, bucket_count: 0 })), error: null }),
  });

  const { data, error } = await getAdminReportSummary('2026-08-01T00:00:00.000Z');
  assert.equal(error, null);
  assert.deepEqual(data, { totalRides: 0, totalRevenue: 0, averageFare: 0, peakHourLabel: '—' });
});

test('getAdminReportSummary returns an error summary when the totals call fails', async () => {
  fakeRpc({
    admin_report_summary: () => ({ data: null, error: { message: 'Not allowed' } }),
    get_peak_hour_histogram: () => ({ data: [], error: null }),
  });

  const { data, error } = await getAdminReportSummary('2026-08-01T00:00:00.000Z');
  assert.equal(error, 'Not allowed');
  assert.deepEqual(data, { totalRides: 0, totalRevenue: 0, averageFare: 0, peakHourLabel: '—' });
});

test('getPeakHourHistogram returns 12 two-hour buckets and labels each one', async () => {
  fakeRpc({ get_peak_hour_histogram: () => ({ data: PEAK_6_TO_8, error: null }) });

  const { data, error } = await getPeakHourHistogram('2026-08-01T00:00:00.000Z');

  assert.equal(error, null);
  assert.equal(data.length, 12);
  assert.deepEqual(data[0], { hourLabel: '12:00 AM–2:00 AM', count: 0 });
  assert.deepEqual(data[3], { hourLabel: '6:00 AM–8:00 AM', count: 2 });
  assert.deepEqual(data[11], { hourLabel: '10:00 PM–12:00 AM', count: 0 });
});

test('getPeakHourHistogram returns { data: [], error } when the call fails', async () => {
  fakeRpc({ get_peak_hour_histogram: () => ({ data: null, error: { message: 'boom' } }) });

  const { data, error } = await getPeakHourHistogram('2026-08-01T00:00:00.000Z');
  assert.deepEqual(data, []);
  assert.equal(error, 'boom');
});

test('getRidesRevenueOverTime maps the per-day rows from the database, oldest first', async () => {
  fakeRpc({
    admin_rides_revenue_daily: () => ({
      data: [
        { day: '2026-10-02', rides: 3, revenue: '46.00' },
        { day: '2026-10-03', rides: 6, revenue: '165.00' },
      ],
      error: null,
    }),
  });

  const { data, error } = await getRidesRevenueOverTime('2026-10-01T00:00:00.000Z');

  assert.equal(error, null);
  assert.deepEqual(data, [
    { day: 'Oct 2', rides: 3, revenue: 46 },
    { day: 'Oct 3', rides: 6, revenue: 165 },
  ]);
});

test('getRidesRevenueOverTime returns { data: [], error } when the call fails', async () => {
  fakeRpc({ admin_rides_revenue_daily: () => ({ data: null, error: { message: 'boom' } }) });

  const { data, error } = await getRidesRevenueOverTime('2026-10-01T00:00:00.000Z');
  assert.deepEqual(data, []);
  assert.equal(error, 'boom');
});

function txnRow(i: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `t${i}`,
    ride_request_id: `r${i}`,
    passenger_name: 'Ana Reyes',
    driver_name: 'Juan Dela Cruz',
    amount: '18.00',
    method: 'cash',
    status: 'paid',
    ride_status: 'completed',
    created_at: '2026-10-03T01:00:00.000Z',
    ...overrides,
  };
}

test('listTransactionsForAdmin maps the joined rows and keeps the ride status next to the payment', async () => {
  const calls = fakeRpc({
    admin_list_transactions: () => ({
      data: [txnRow(1), txnRow(2, { status: 'paid', ride_status: 'cancelled', amount: '15.00' })],
      error: null,
    }),
  });

  const { data, error, truncated } = await listTransactionsForAdmin('2026-10-01T00:00:00.000Z');

  assert.equal(error, null);
  assert.equal(truncated, false);
  assert.deepEqual(calls[0], { fn: 'admin_list_transactions', args: { p_since: '2026-10-01T00:00:00.000Z' } });
  assert.deepEqual(data[0], {
    id: 't1',
    rideRequestId: 'r1',
    passengerName: 'Ana Reyes',
    driverName: 'Juan Dela Cruz',
    amount: 18,
    method: 'cash',
    status: 'paid',
    rideStatus: 'completed',
    createdAt: '2026-10-03T01:00:00.000Z',
  });
  // A paid payment on a cancelled ride is still listed, but flagged by its ride status.
  assert.equal(data[1].rideStatus, 'cancelled');
  assert.equal(data[1].amount, 15);
});

test('listTransactionsForAdmin shows "—" for a missing driver or passenger name instead of dropping the payment', async () => {
  fakeRpc({ admin_list_transactions: () => ({ data: [txnRow(1, { driver_name: null, passenger_name: null })], error: null }) });

  const { data } = await listTransactionsForAdmin('2026-10-01T00:00:00.000Z');
  assert.equal(data.length, 1);
  assert.equal(data[0].driverName, '—');
  assert.equal(data[0].passengerName, '—');
});

test('listTransactionsForAdmin reports truncated and returns exactly 2000 rows when the database sends the extra row', async () => {
  fakeRpc({ admin_list_transactions: () => ({ data: Array.from({ length: 2001 }, (_, i) => txnRow(i)), error: null }) });

  const { data, truncated } = await listTransactionsForAdmin('2026-10-01T00:00:00.000Z');
  assert.equal(data.length, 2000);
  assert.equal(truncated, true);
});

test('listTransactionsForAdmin returns { data: [], error } when the call fails', async () => {
  fakeRpc({ admin_list_transactions: () => ({ data: null, error: { message: 'Not allowed' } }) });

  const { data, error, truncated } = await listTransactionsForAdmin('2026-10-01T00:00:00.000Z');
  assert.deepEqual(data, []);
  assert.equal(error, 'Not allowed');
  assert.equal(truncated, false);
});
