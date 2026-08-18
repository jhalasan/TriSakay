import { getAdminReportSummary, listTransactionsForAdmin } from '@trisakay/services';
import type { ReportSummary, TransactionRow } from '../types/report';
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

/** Read-only (FR-5.3, 5.4, 9.7). */
export async function getReportSummary(range: ReportDateRange): Promise<ServiceResult<ReportSummary>> {
  const { data, error } = await getAdminReportSummary(dateRangeSinceIso(range));
  return { data, error };
}

export async function listTransactions(range: ReportDateRange): Promise<ServiceResult<TransactionRow[]>> {
  const { data, error } = await listTransactionsForAdmin(dateRangeSinceIso(range));
  return { data, error };
}
