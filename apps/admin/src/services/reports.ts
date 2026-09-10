import { getAdminReportSummary, getPeakHourHistogram as getPeakHourHistogramShared, getRidesRevenueOverTime as getRidesRevenueOverTimeShared, listTransactionsForAdmin } from '@trisakay/services';
import type { PeakHourBucket, ReportSummary, RidesRevenuePoint, TransactionRow } from '../types/report';
import type { ServiceResult } from './drivers';

export type ReportDateRange = '7d' | '30d' | 'quarter';

/** Cutoff for a given range selector, computed against "now" so a 7-day report always means the trailing week. */
export function dateRangeSinceIso(range: ReportDateRange): string {
  const now = new Date();
  if (range === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (range === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
  return new Date(now.getFullYear(), quarterStartMonth, 1).toISOString();
}

/** The immediately preceding period of equal length to `dateRangeSinceIso(range)`, for the Reports "vs previous period" deltas. */
function previousPeriodBoundsIso(range: ReportDateRange): { since: string; until: string } {
  const currentSince = new Date(dateRangeSinceIso(range));
  if (range === '7d') return { since: new Date(currentSince.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), until: currentSince.toISOString() };
  if (range === '30d') return { since: new Date(currentSince.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), until: currentSince.toISOString() };
  return { since: new Date(currentSince.getFullYear(), currentSince.getMonth() - 3, 1).toISOString(), until: currentSince.toISOString() };
}

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null; // "vs previous 0" has no meaningful percentage
  return ((current - previous) / previous) * 100;
}

/** Read-only (FR-5.3, 5.4, 9.7). Fetches the current period and, in parallel, the immediately preceding one of equal length for the two "vs previous period" deltas the mock adds. */
export async function getReportSummary(range: ReportDateRange): Promise<ServiceResult<ReportSummary>> {
  const previous = previousPeriodBoundsIso(range);
  const [current, prior] = await Promise.all([
    getAdminReportSummary(dateRangeSinceIso(range)),
    getAdminReportSummary(previous.since, previous.until),
  ]);
  if (current.error) {
    return { data: { ...current.data, totalRidesDeltaPct: null, totalRevenueDeltaPct: null }, error: current.error };
  }

  return {
    data: {
      ...current.data,
      totalRidesDeltaPct: prior.error ? null : deltaPct(current.data.totalRides, prior.data.totalRides),
      totalRevenueDeltaPct: prior.error ? null : deltaPct(current.data.totalRevenue, prior.data.totalRevenue),
    },
    error: null,
  };
}

export async function listTransactions(range: ReportDateRange): Promise<ServiceResult<TransactionRow[]>> {
  const { data, error } = await listTransactionsForAdmin(dateRangeSinceIso(range));
  return { data, error };
}

export async function getRidesRevenueOverTime(range: ReportDateRange): Promise<ServiceResult<RidesRevenuePoint[]>> {
  const { data, error } = await getRidesRevenueOverTimeShared(dateRangeSinceIso(range));
  return { data, error };
}

export async function getPeakHourHistogram(range: ReportDateRange): Promise<ServiceResult<PeakHourBucket[]>> {
  const { data, error } = await getPeakHourHistogramShared(dateRangeSinceIso(range));
  return { data, error };
}
