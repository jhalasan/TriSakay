import {
  getAdminDashboardStats,
  getRidesPerDay as getRidesPerDayShared,
  getTripStatusBreakdown as getTripStatusBreakdownShared,
  listExpiringFranchises as listExpiringFranchisesShared,
  listOverdueComplaints as listOverdueComplaintsShared,
  listRecentTripActivity as listRecentTripActivityShared,
} from '@trisakay/services';
import type { ExpiringFranchiseRow, OverdueComplaintRow, RecentTripActivityRow, RidesPerDayPoint, TripStatusCount } from '@trisakay/services';
import type { ServiceResult } from './drivers';

export type { ExpiringFranchiseRow, OverdueComplaintRow, RecentTripActivityRow, RidesPerDayPoint, TripStatusCount };

export interface DashboardStats {
  totalDrivers: number;
  activeRides: number;
  pendingVerifications: number;
  openComplaints: number;
}

/**
 * Thin wrapper over the shared packages/services/src/admin/dashboard module,
 * matching this app's one-file-per-feature service convention (drivers.ts,
 * monitoring.ts, etc.). Unlike those, this one is real from the start —
 * Dashboard.tsx never had its own mock service to begin with.
 */
export async function getDashboardStats(): Promise<ServiceResult<DashboardStats | null>> {
  const { data, error } = await getAdminDashboardStats();
  return { data, error };
}

export async function listOverdueComplaints(): Promise<ServiceResult<OverdueComplaintRow[]>> {
  const { data, error } = await listOverdueComplaintsShared();
  return { data, error };
}

export async function listExpiringFranchises(): Promise<ServiceResult<ExpiringFranchiseRow[]>> {
  const { data, error } = await listExpiringFranchisesShared();
  return { data, error };
}

export async function listRecentTripActivity(limit?: number): Promise<ServiceResult<RecentTripActivityRow[]>> {
  const { data, error } = await listRecentTripActivityShared(limit);
  return { data, error };
}

export async function getRidesPerDay(): Promise<ServiceResult<RidesPerDayPoint[]>> {
  const { data, error } = await getRidesPerDayShared();
  return { data, error };
}

export async function getTripStatusBreakdown(): Promise<ServiceResult<TripStatusCount[]>> {
  const { data, error } = await getTripStatusBreakdownShared();
  return { data, error };
}
