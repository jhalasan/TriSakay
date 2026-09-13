import { getSupabaseClient } from '../supabase/client.ts';

export interface AdminDashboardStats {
  totalDrivers: number;
  activeRides: number;
  pendingVerifications: number;
  openComplaints: number;
}

export interface GetAdminDashboardStatsResult {
  data: AdminDashboardStats | null;
  error: string | null;
}

/**
 * Four independent counts (not four independently-rendered tiles — this is
 * one stat block) run as one Promise.all. A partial result would show
 * misleadingly precise-looking wrong numbers, so any single query error
 * fails the whole call.
 */
export async function getAdminDashboardStats(): Promise<GetAdminDashboardStatsResult> {
  const client = getSupabaseClient();

  const [totalDrivers, activeRides, pendingVerifications, openComplaints] = await Promise.all([
    client.from('users').select('*', { count: 'exact', head: true }).eq('role', 'driver'),
    client.from('trips').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    client.from('driver_profiles').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),
    client
      .from('complaints')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'under_review', 'escalated', 'mediation_scheduled']),
  ]);

  const firstError = [totalDrivers, activeRides, pendingVerifications, openComplaints].find((r) => r.error)?.error;
  if (firstError) return { data: null, error: firstError.message };

  return {
    data: {
      totalDrivers: totalDrivers.count ?? 0,
      activeRides: activeRides.count ?? 0,
      pendingVerifications: pendingVerifications.count ?? 0,
      openComplaints: openComplaints.count ?? 0,
    },
    error: null,
  };
}

async function resolveUserNames(client: ReturnType<typeof getSupabaseClient>, ids: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return new Map();

  const { data } = await client.from('users').select('id, full_name').in('id', uniqueIds);
  const names = new Map<string, string>();
  for (const row of data ?? []) names.set(row.id, row.full_name!);
  return names;
}

export interface OverdueComplaintRow {
  id: string;
  submittedByName: string | null;
  againstUserName: string | null;
  category: 'fare' | 'conduct' | 'safety' | 'low_rating' | 'vehicle_condition' | 'other';
  status: 'open' | 'under_review';
  createdAt: string;
  businessDaysElapsed: number;
}

export interface ListOverdueComplaintsResult {
  data: OverdueComplaintRow[];
  error: string | null;
}

/**
 * Reads v_overdue_complaints (docs/SCHEMA.MD ~L1224 — its own comment says
 * "Feeds the PSO oversight dashboard"). The view has no name columns, only
 * submitted_by/against_user_id ids, and PostgREST's embed-through-view
 * support is inconsistent enough not to depend on — so this does one
 * follow-up `users` lookup instead and merges names client-side. A missing
 * name degrades to null rather than failing the whole row; the category and
 * days-overdue are still actionable without it.
 */
export async function listOverdueComplaints(): Promise<ListOverdueComplaintsResult> {
  const client = getSupabaseClient();
  const { data, error } = await client.from('v_overdue_complaints').select('*');

  if (error) return { data: [], error: error.message };

  const ids = (data ?? []).flatMap((row) => [row.submitted_by, row.against_user_id].filter((id): id is string => !!id));
  const names = await resolveUserNames(client, ids);

  const rows = (data ?? []).map((row) => ({
    id: row.id!,
    submittedByName: row.submitted_by ? (names.get(row.submitted_by) ?? null) : null,
    againstUserName: row.against_user_id ? (names.get(row.against_user_id) ?? null) : null,
    category: row.category!,
    status: row.status as 'open' | 'under_review',
    createdAt: row.created_at!,
    businessDaysElapsed: row.business_days_elapsed ?? 0,
  }));

  return { data: rows, error: null };
}

export interface ExpiringFranchiseRow {
  tricycleId: string;
  driverId: string;
  driverName: string | null;
  plateNo: string;
  mtopNo: string | null;
  mtopExpiryDate: string;
  daysUntilExpiry: number;
}

export interface ListExpiringFranchisesResult {
  data: ExpiringFranchiseRow[];
  error: string | null;
}

/** Reads v_expiring_franchises (docs/SCHEMA.MD ~L1199). Same name-resolution approach as listOverdueComplaints above. */
export async function listExpiringFranchises(): Promise<ListExpiringFranchisesResult> {
  const client = getSupabaseClient();
  const { data, error } = await client.from('v_expiring_franchises').select('*');

  if (error) return { data: [], error: error.message };

  const ids = (data ?? []).map((row) => row.driver_id).filter((id): id is string => !!id);
  const names = await resolveUserNames(client, ids);

  const rows = (data ?? []).map((row) => ({
    tricycleId: row.tricycle_id!,
    driverId: row.driver_id!,
    driverName: row.driver_id ? (names.get(row.driver_id) ?? null) : null,
    plateNo: row.plate_no!,
    mtopNo: row.mtop_no,
    mtopExpiryDate: row.mtop_expiry_date!,
    daysUntilExpiry: row.days_until_expiry ?? 0,
  }));

  return { data: rows, error: null };
}

export interface RecentTripActivityRow {
  id: string;
  driverName: string | null;
  passengerName: string | null;
  status: 'forming' | 'active' | 'completed' | 'cancelled';
  fare: number | null;
  updatedAt: string;
}

export interface ListRecentTripActivityResult {
  data: RecentTripActivityRow[];
  error: string | null;
}

/**
 * One row per ride_request, not per trip — a trip is a shared ride
 * (trips.max_seats) with zero-to-many ride_requests attached, and each
 * ride_request is the thing that actually carries a passenger and a fare
 * (trips itself has neither column). Two flat queries plus the existing
 * resolveUserNames() follow-up, matching this file's established
 * no-nested-embeds convention (see listOverdueComplaints/
 * listExpiringFranchises above) rather than a multi-hop PostgREST embed.
 *
 * Ordering/truncation happens after the second query, once each request's
 * trip.updated_at is known, so the first query over-fetches by 4x on its
 * own requested_at ordering to give the final recency sort enough rows to
 * work with.
 */
export async function listRecentTripActivity(limit = 10): Promise<ListRecentTripActivityResult> {
  const client = getSupabaseClient();

  const { data: requests, error: requestsError } = await client
    .from('ride_requests')
    .select('id, passenger_id, final_fare, trip_id')
    .not('trip_id', 'is', null)
    .order('requested_at', { ascending: false })
    .limit(limit * 4);

  if (requestsError) return { data: [], error: requestsError.message };
  if (!requests || requests.length === 0) return { data: [], error: null };

  const tripIds = [...new Set(requests.map((r) => r.trip_id).filter((id): id is string => id !== null))];

  const { data: trips, error: tripsError } = await client.from('trips').select('id, driver_id, status, updated_at').in('id', tripIds);
  if (tripsError) return { data: [], error: tripsError.message };

  const tripById = new Map((trips ?? []).map((t) => [t.id, t]));
  const names = await resolveUserNames(client, [...(trips ?? []).map((t) => t.driver_id), ...requests.map((r) => r.passenger_id)]);

  const rows = requests
    .map((r): RecentTripActivityRow | null => {
      const trip = r.trip_id ? tripById.get(r.trip_id) : undefined;
      if (!trip) return null;
      return {
        id: r.id,
        driverName: names.get(trip.driver_id) ?? null,
        passengerName: names.get(r.passenger_id) ?? null,
        status: trip.status,
        fare: r.final_fare,
        updatedAt: trip.updated_at,
      };
    })
    .filter((r): r is RecentTripActivityRow => r !== null)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);

  return { data: rows, error: null };
}

export interface RidesPerDayPoint {
  day: string; // e.g. 'Mon 8/17'
  count: number;
}

export interface GetRidesPerDayResult {
  data: RidesPerDayPoint[];
  error: string | null;
}

/**
 * "Rides Over Time (Week)" dashboard chart — completed ride_requests for
 * each of the last 7 calendar days (local wall-clock, matching the rest of
 * this app's en-PH rendering), oldest first. Always returns exactly 7
 * points, zero-filled, so the chart never shows a gap for a quiet day.
 */
export async function getRidesPerDay(): Promise<GetRidesPerDayResult> {
  const client = getSupabaseClient();
  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);

  const { data, error } = await client
    .from('ride_requests')
    .select('requested_at')
    .eq('status', 'completed')
    .gte('requested_at', since.toISOString());

  if (error) return { data: [], error: error.message };

  const days: { key: string; day: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ key: d.toLocaleDateString('en-CA'), day: d.toLocaleDateString('en-PH', { weekday: 'short', month: 'numeric', day: 'numeric' }) });
  }

  const countByKey = new Map<string, number>();
  for (const row of data ?? []) {
    const key = new Date(row.requested_at).toLocaleDateString('en-CA');
    countByKey.set(key, (countByKey.get(key) ?? 0) + 1);
  }

  return { data: days.map(({ key, day }) => ({ day, count: countByKey.get(key) ?? 0 })), error: null };
}

export interface TripStatusCount {
  status: 'forming' | 'active' | 'completed' | 'cancelled';
  count: number;
}

export interface GetTripStatusBreakdownResult {
  data: TripStatusCount[];
  error: string | null;
}

const TRIP_STATUSES: TripStatusCount['status'][] = ['forming', 'active', 'completed', 'cancelled'];

/** "Ride Status" dashboard donut — ride counts by TripStatus, all-time, 4 parallel counts (same idiom as getAdminDashboardStats). */
export async function getTripStatusBreakdown(): Promise<GetTripStatusBreakdownResult> {
  const client = getSupabaseClient();

  const results = await Promise.all(
    TRIP_STATUSES.map((status) => client.from('trips').select('*', { count: 'exact', head: true }).eq('status', status))
  );

  const firstError = results.find((r) => r.error)?.error;
  if (firstError) return { data: [], error: firstError.message };

  return { data: TRIP_STATUSES.map((status, i) => ({ status, count: results[i].count ?? 0 })), error: null };
}
