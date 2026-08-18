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
  for (const row of data ?? []) names.set(row.id, row.full_name);
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
  status: 'forming' | 'active' | 'completed' | 'cancelled';
  updatedAt: string;
}

export interface ListRecentTripActivityResult {
  data: RecentTripActivityRow[];
  error: string | null;
}

/**
 * Deliberately not a nested PostgREST embed (`driver_profiles(users(...))`)
 * — this codebase has no precedent of multi-hop embeds anywhere, and every
 * existing cross-user join instead uses either a security-definer RPC or,
 * as here, a plain follow-up lookup (same resolveUserNames() helper
 * listOverdueComplaints/listExpiringFranchises above already use). trips.driver_id
 * holds the same value as users.id (driver_profiles.user_id IS users.id),
 * so the follow-up .in() lookup works without hopping through driver_profiles.
 */
export async function listRecentTripActivity(limit = 10): Promise<ListRecentTripActivityResult> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('trips')
    .select('id, status, updated_at, driver_id')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: error.message };

  const names = await resolveUserNames(client, (data ?? []).map((row) => row.driver_id));

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    driverName: names.get(row.driver_id) ?? null,
    status: row.status,
    updatedAt: row.updated_at,
  }));

  return { data: rows, error: null };
}
