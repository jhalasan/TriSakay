import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

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
 * FR-5.3/5.4/9.7 — date-ranged aggregates. `totalRides` counts completed
 * ride_requests (a ride is only "real" once it happened, not merely
 * requested); `totalRevenue` sums paid transactions in the same window —
 * deliberately a separate query rather than joining, since a completed ride
 * and its payment can land in different moments of the same window.
 * `peakHourLabel` buckets completed rides into 2-hour windows (matching the
 * wireframe's "6:00–8:00 AM" style) and reports the busiest one; ties break
 * toward the earliest bucket. No rows in range degrades to a `0`/`—`
 * summary rather than an error — an empty report is a valid answer.
 */
export async function getAdminReportSummary(sinceIso: string): Promise<GetAdminReportSummaryResult> {
  const client = getSupabaseClient();

  const [{ data: rides, error: ridesError }, { data: paidTxns, error: txnsError }] = await Promise.all([
    client.from('ride_requests').select('requested_at').eq('status', 'completed').gte('requested_at', sinceIso),
    client.from('transactions').select('amount').eq('status', 'paid').gte('created_at', sinceIso),
  ]);

  if (ridesError) return { data: emptySummary(), error: ridesError.message };
  if (txnsError) return { data: emptySummary(), error: txnsError.message };

  const totalRides = rides?.length ?? 0;
  const totalRevenue = (paidTxns ?? []).reduce((sum, t) => sum + Number(t.amount), 0);
  const averageFare = totalRides > 0 ? totalRevenue / totalRides : 0;
  const peakHourLabel = totalRides > 0 ? peakTwoHourWindowLabel(rides!.map((r) => r.requested_at)) : '—';

  return { data: { totalRides, totalRevenue, averageFare, peakHourLabel }, error: null };
}

function emptySummary(): AdminReportSummary {
  return { totalRides: 0, totalRevenue: 0, averageFare: 0, peakHourLabel: '—' };
}

/** Uses local wall-clock hours (not UTC) deliberately — matches lib/format.ts's en-PH date/time rendering, so "peak hour" means the PSO's own local time, not a UTC bucket. */
function peakTwoHourWindowLabel(timestamps: string[]): string {
  const counts = new Array(12).fill(0); // 12 two-hour buckets covering a day
  for (const ts of timestamps) {
    const hour = new Date(ts).getHours();
    counts[Math.floor(hour / 2)]++;
  }
  let peakBucket = 0;
  for (let i = 1; i < counts.length; i++) {
    if (counts[i] > counts[peakBucket]) peakBucket = i;
  }
  const startHour = peakBucket * 2;
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

export interface AdminTransactionRow {
  id: string;
  rideRequestId: string;
  passengerName: string;
  driverName: string;
  amount: number;
  method: AdminTransactionMethod;
  status: AdminTransactionStatus;
  createdAt: string;
}

export interface ListTransactionsForAdminResult {
  data: AdminTransactionRow[];
  error: string | null;
}

/**
 * FR-9.7 — every transaction in the window, newest first. `transactions`
 * has no passenger/driver columns of its own; resolving names is a 3-hop
 * chain (transactions -> ride_requests -> trips -> users), done as
 * sequential follow-up queries rather than a nested embed, same convention
 * as every other admin/*.ts module. A transaction whose ride was cancelled
 * before a driver was ever assigned has no trip row, so driverName degrades
 * to '—' rather than dropping the transaction.
 */
export async function listTransactionsForAdmin(sinceIso: string): Promise<ListTransactionsForAdminResult> {
  const client = getSupabaseClient();

  const { data: txns, error: txnsError } = await client
    .from('transactions')
    .select('id, ride_request_id, amount, method, status, created_at')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false });

  if (txnsError) return { data: [], error: txnsError.message };
  if (!txns || txns.length === 0) return { data: [], error: null };

  const rideRequestIds = [...new Set(txns.map((t) => t.ride_request_id))];
  const { data: rideRequests, error: rideRequestsError } = await client
    .from('ride_requests')
    .select('id, passenger_id, trip_id')
    .in('id', rideRequestIds);

  if (rideRequestsError) return { data: [], error: rideRequestsError.message };

  const tripIds = [...new Set((rideRequests ?? []).map((r) => r.trip_id).filter((id): id is string => !!id))];
  const { data: trips, error: tripsError } = tripIds.length
    ? await client.from('trips').select('id, driver_id').in('id', tripIds)
    : { data: [] as { id: string; driver_id: string }[], error: null };

  if (tripsError) return { data: [], error: tripsError.message };

  const driverIdByTripId = new Map((trips ?? []).map((t) => [t.id, t.driver_id]));
  const rideRequestById = new Map((rideRequests ?? []).map((r) => [r.id, r]));

  const userIds = [
    ...new Set(
      (rideRequests ?? []).flatMap((r) => {
        const driverId = r.trip_id ? driverIdByTripId.get(r.trip_id) : undefined;
        return [r.passenger_id, driverId].filter((id): id is string => !!id);
      })
    ),
  ];
  const { data: users, error: usersError } = await client.from('users').select('id, full_name').in('id', userIds);
  if (usersError) return { data: [], error: usersError.message };

  const nameById = new Map((users ?? []).map((u) => [u.id, u.full_name]));

  const rows: AdminTransactionRow[] = txns.map((t) => {
    const rideRequest = rideRequestById.get(t.ride_request_id);
    const driverId = rideRequest?.trip_id ? driverIdByTripId.get(rideRequest.trip_id) : undefined;
    return {
      id: t.id,
      rideRequestId: t.ride_request_id,
      passengerName: rideRequest ? (nameById.get(rideRequest.passenger_id) ?? '—') : '—',
      driverName: driverId ? (nameById.get(driverId) ?? '—') : '—',
      amount: Number(t.amount),
      method: t.method,
      status: t.status,
      createdAt: t.created_at,
    };
  });

  return { data: rows, error: null };
}
