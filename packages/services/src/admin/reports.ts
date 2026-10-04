import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

// Every report number is built in the database (admin_* functions, get_peak_hour_histogram) so
// a long date range never hits PostgREST's 1,000 row default or a too-long URL. Rides are
// counted by the day they COMPLETED, in Manila time (the database itself runs in UTC).
// Only completed rides count: a cancelled ride can hold a paid cash row, but that money is
// not revenue for a ride that did not happen.
export interface AdminReportSummary {
  totalRides: number;
  totalRevenue: number;
  averageFare: number;
  peakHourLabel: string;
}

export interface GetAdminReportSummaryResult {
  data: AdminReportSummary;
  error: string | null;
}

/**
 * FR-5.3/5.4/9.7 — date-ranged aggregates over COMPLETED rides. `totalRevenue` is the paid
 * payments of those rides; `averageFare` is the mean fare of those same rides, so the two
 * always describe the same set. `peakHourLabel` is the busiest 2-hour window (ties go to the
 * earliest); it is only worked out for an open-ended range, since the previous-period
 * comparison only needs rides and revenue. No rides in range is a valid answer, not an error.
 */
export async function getAdminReportSummary(sinceIso: string, untilIso?: string): Promise<GetAdminReportSummaryResult> {
  const client = getSupabaseClient();

  const [summary, peak] = await Promise.all([
    client.rpc('admin_report_summary', untilIso ? { p_since: sinceIso, p_until: untilIso } : { p_since: sinceIso }),
    untilIso ? Promise.resolve(null) : client.rpc('get_peak_hour_histogram', { p_since: sinceIso }),
  ]);

  if (summary.error) return { data: emptySummary(), error: summary.error.message };
  if (peak?.error) return { data: emptySummary(), error: peak.error.message };

  const row = summary.data?.[0];
  const totalRides = row ? Number(row.total_rides) : 0;
  const peakHourLabel = peak && totalRides > 0 ? peakLabelFromHistogram((peak.data ?? []).map((b) => Number(b.bucket_count))) : '—';

  return {
    data: {
      totalRides,
      totalRevenue: row ? Number(row.total_revenue) : 0,
      averageFare: row ? Number(row.average_fare) : 0,
      peakHourLabel,
    },
    error: null,
  };
}

function emptySummary(): AdminReportSummary {
  return { totalRides: 0, totalRevenue: 0, averageFare: 0, peakHourLabel: '—' };
}

function peakLabelFromHistogram(counts: number[]): string {
  let peakBucket = 0;
  for (let i = 1; i < counts.length; i++) {
    if (counts[i] > counts[peakBucket]) peakBucket = i;
  }
  return bucketLabel(peakBucket);
}

function bucketLabel(bucketIndex: number): string {
  const startHour = bucketIndex * 2;
  return `${formatHour(startHour)}–${formatHour(startHour + 2)}`;
}

function formatHour(hour24: number): string {
  const h = hour24 % 24;
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${period}`;
}

export type AdminTransactionMethod = Database['public']['Enums']['payment_method'];
export type AdminTransactionStatus = Database['public']['Enums']['payment_status'];
export type AdminTransactionRideStatus = Database['public']['Enums']['ride_status'];

export interface AdminTransactionRow {
  id: string;
  rideRequestId: string;
  passengerName: string;
  driverName: string;
  amount: number;
  method: AdminTransactionMethod;
  status: AdminTransactionStatus;
  /** What happened to the ride itself; a paid payment on a cancelled ride is not revenue. */
  rideStatus: AdminTransactionRideStatus;
  createdAt: string;
}

export interface ListTransactionsForAdminResult {
  data: AdminTransactionRow[];
  error: string | null;
  /** True when the 2,000 row cap was hit, meaning older transactions in the window were not returned. */
  truncated: boolean;
}

const TRANSACTIONS_ROW_CAP = 2000;

/**
 * FR-9.7 — every payment in the window, newest first, with passenger and driver names joined
 * in the database (admin_list_transactions). A payment whose ride never had a driver shows
 * '—' for the driver instead of dropping out of the list.
 */
export async function listTransactionsForAdmin(sinceIso: string): Promise<ListTransactionsForAdminResult> {
  const { data, error } = await getSupabaseClient().rpc('admin_list_transactions', { p_since: sinceIso });

  if (error) return { data: [], error: error.message, truncated: false };

  const all = data ?? [];
  const truncated = all.length > TRANSACTIONS_ROW_CAP;
  const rows: AdminTransactionRow[] = all.slice(0, TRANSACTIONS_ROW_CAP).map((t) => ({
    id: t.id,
    rideRequestId: t.ride_request_id,
    passengerName: t.passenger_name ?? '—',
    driverName: t.driver_name ?? '—',
    amount: Number(t.amount),
    method: t.method,
    status: t.status,
    rideStatus: t.ride_status,
    createdAt: t.created_at,
  }));

  return { data: rows, error: null, truncated };
}

export interface PeakHourBucket {
  hourLabel: string;
  count: number;
}

export interface GetPeakHourHistogramResult {
  data: PeakHourBucket[];
  error: string | null;
}

/** "Peak Hours" report chart — the 12 two-hour buckets (Manila time) the summary's peakHourLabel is derived from, in full. */
export async function getPeakHourHistogram(sinceIso: string): Promise<GetPeakHourHistogramResult> {
  const { data, error } = await getSupabaseClient().rpc('get_peak_hour_histogram', { p_since: sinceIso });

  if (error) return { data: [], error: error.message };

  const counts = new Array<number>(12).fill(0);
  for (const row of data ?? []) counts[row.bucket_index] = Number(row.bucket_count);
  return { data: counts.map((count, i) => ({ hourLabel: bucketLabel(i), count })), error: null };
}

export interface RidesRevenuePoint {
  day: string;
  rides: number;
  revenue: number;
}

export interface GetRidesRevenueOverTimeResult {
  data: RidesRevenuePoint[];
  error: string | null;
}

/** "Rides / Revenue" report chart — completed rides and their paid revenue per Manila calendar day, oldest first. Days with nothing are left out. */
export async function getRidesRevenueOverTime(sinceIso: string): Promise<GetRidesRevenueOverTimeResult> {
  const { data, error } = await getSupabaseClient().rpc('admin_rides_revenue_daily', { p_since: sinceIso });

  if (error) return { data: [], error: error.message };

  return {
    data: (data ?? []).map((row) => ({
      // The date comes back as plain YYYY-MM-DD; label it without letting the browser shift it by a timezone.
      day: new Date(`${row.day}T00:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      rides: Number(row.rides),
      revenue: Number(row.revenue),
    })),
    error: null,
  };
}
