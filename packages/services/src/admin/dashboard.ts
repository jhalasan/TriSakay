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
    client.from('ride_requests').select('*', { count: 'exact', head: true }).in('status', ['assigned', 'ongoing']),
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
  /** The ride's own status — not its trip's, which can read "completed" for a ride that was cancelled. */
  status: RideStatusCount['status'];
  fare: number | null;
  updatedAt: string;
}

export interface ListRecentTripActivityResult {
  data: RecentTripActivityRow[];
  error: string | null;
}

/**
 * One row per ride_request that has a driver, newest first by the moment it last changed
 * (completed, cancelled, or requested). The status and fare are the ride's own: a cancelled ride
 * shows as cancelled with no fare, even when its trip went on to finish with someone else.
 */
export async function listRecentTripActivity(limit = 10): Promise<ListRecentTripActivityResult> {
  const client = getSupabaseClient();

  const { data: requests, error: requestsError } = await client
    .from('ride_requests')
    .select('id, passenger_id, final_fare, trip_id, status, requested_at, completed_at, cancelled_at')
    .not('trip_id', 'is', null)
    .order('requested_at', { ascending: false })
    .limit(limit * 4);

  if (requestsError) return { data: [], error: requestsError.message };
  if (!requests || requests.length === 0) return { data: [], error: null };

  const tripIds = [...new Set(requests.map((r) => r.trip_id).filter((id): id is string => id !== null))];

  const { data: trips, error: tripsError } = await client.from('trips').select('id, driver_id').in('id', tripIds);
  if (tripsError) return { data: [], error: tripsError.message };

  const driverByTripId = new Map((trips ?? []).map((t) => [t.id, t.driver_id]));
  const names = await resolveUserNames(client, [...(trips ?? []).map((t) => t.driver_id), ...requests.map((r) => r.passenger_id)]);

  const rows = requests
    .map((r): RecentTripActivityRow | null => {
      const driverId = r.trip_id ? driverByTripId.get(r.trip_id) : undefined;
      if (!driverId) return null;
      return {
        id: r.id,
        driverName: names.get(driverId) ?? null,
        passengerName: names.get(r.passenger_id) ?? null,
        status: r.status,
        fare: r.status === 'completed' ? r.final_fare : null,
        updatedAt: r.completed_at ?? r.cancelled_at ?? r.requested_at,
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

const MANILA_TZ = 'Asia/Manila';
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "Rides Over Time (Week)" dashboard chart — rides COMPLETED on each of the last 7 Manila
 * calendar days, oldest first. Always returns exactly 7 points, zero-filled, so a quiet day shows
 * as 0 instead of a gap. Counted in the database, so it is not cut off at 1,000 rows and does
 * not depend on the browser's timezone. Manila has no daylight saving, so stepping back by whole
 * 24 hour days always lands on the right calendar day.
 */
export async function getRidesPerDay(): Promise<GetRidesPerDayResult> {
  const now = Date.now();
  const days: { key: string; day: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * DAY_MS);
    days.push({
      key: d.toLocaleDateString('en-CA', { timeZone: MANILA_TZ }),
      day: d.toLocaleDateString('en-PH', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: MANILA_TZ }),
    });
  }

  const { data, error } = await getSupabaseClient().rpc('admin_rides_revenue_daily', { p_since: `${days[0].key}T00:00:00+08:00` });
  if (error) return { data: [], error: error.message };

  const countByKey = new Map((data ?? []).map((row) => [row.day, Number(row.rides)]));
  return { data: days.map(({ key, day }) => ({ day, count: countByKey.get(key) ?? 0 })), error: null };
}

export interface RideStatusCount {
  status: 'pending' | 'assigned' | 'ongoing' | 'completed' | 'cancelled';
  count: number;
}

export interface GetRideStatusBreakdownResult {
  data: RideStatusCount[];
  error: string | null;
}

const RIDE_STATUSES: RideStatusCount['status'][] = ['pending', 'assigned', 'ongoing', 'completed', 'cancelled'];

/** "Ride status" dashboard donut — RIDE counts by status, all time (a trip can hold several rides or none, so trips are not what this chart is about). */
export async function getRideStatusBreakdown(): Promise<GetRideStatusBreakdownResult> {
  const { data, error } = await getSupabaseClient().rpc('admin_ride_status_counts');
  if (error) return { data: [], error: error.message };

  const countByStatus = new Map((data ?? []).map((row) => [row.status, Number(row.ride_count)]));
  return { data: RIDE_STATUSES.map((status) => ({ status, count: countByStatus.get(status) ?? 0 })), error: null };
}
