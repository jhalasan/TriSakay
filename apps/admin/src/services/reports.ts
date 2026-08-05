import { MOCK_REPORT_SUMMARY, MOCK_TRANSACTIONS } from '../mocks/reports.ts';
import { wait } from '../mocks/delay.ts';
import type { ReportSummary, TransactionRow } from '../types/report';
import type { ServiceResult } from './drivers';

/** Read-only (FR-5.3, 5.4, 9.7). */
export async function getReportSummary(): Promise<ServiceResult<ReportSummary>> {
  await wait();
  return { data: MOCK_REPORT_SUMMARY, error: null };
}

export async function listTransactions(): Promise<ServiceResult<TransactionRow[]>> {
  await wait();
  return { data: MOCK_TRANSACTIONS, error: null };
}
