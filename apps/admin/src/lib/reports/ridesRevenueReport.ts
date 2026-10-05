import type { PeakHourBucket, ReportSummary, RidesRevenuePoint, TransactionRow } from '../../types/report.ts';
import { formatCurrency, paymentMethodLabel } from '../format.ts';
import type { ReportModel } from './types.ts';

export interface RidesRevenueReportInput {
  /** e.g. "Last 30 days · 6 September to 5 October 2026". Shown under the title. */
  periodLabel: string;
  /** e.g. "previous 30 days", used in the change-since-last-period lines. */
  previousLabel: string;
  summary: ReportSummary;
  daily: RidesRevenuePoint[];
  peakHours: PeakHourBucket[];
  transactions: TransactionRow[];
  /** True when the payment list was cut at its row cap, so the payment tables may not cover the whole period. */
  transactionsTruncated: boolean;
}

function change(pct: number | null, previousLabel: string): string {
  if (pct == null) return 'No earlier period to compare with';
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs ${previousLabel}`;
}

/**
 * The Reports screen as a printed page: completed rides, the revenue of those rides, how it split between cash
 * and GCash, and the busiest days and hours. Only completed rides count; a paid payment on a cancelled ride is
 * listed under "Payment notes" but is not revenue.
 */
export function buildRidesRevenueReport(input: RidesRevenueReportInput): ReportModel {
  const { summary, daily, peakHours, transactions } = input;

  const paidOnCompleted = transactions.filter((t) => t.status === 'paid' && t.rideStatus === 'completed');
  const byMethod = new Map<string, { count: number; amount: number }>();
  for (const payment of paidOnCompleted) {
    const row = byMethod.get(payment.method) ?? { count: 0, amount: 0 };
    row.count += 1;
    row.amount += payment.amount;
    byMethod.set(payment.method, row);
  }
  const methodRows = [...byMethod.entries()].map(([method, row]) => [paymentMethodLabel(method), String(row.count), formatCurrency(row.amount)]);
  if (methodRows.length > 0) {
    const totalCount = paidOnCompleted.length;
    const totalAmount = paidOnCompleted.reduce((sum, t) => sum + t.amount, 0);
    methodRows.push(['Total', String(totalCount), formatCurrency(totalAmount)]);
  }

  const paidOnCancelled = transactions.filter((t) => t.status === 'paid' && t.rideStatus === 'cancelled');
  const unpaidCompleted = transactions.filter((t) => t.status === 'pending' && t.rideStatus === 'completed');
  const notes: [string, string][] = [
    ['Paid payments on cancelled rides (not counted as revenue)', `${paidOnCancelled.length} · ${formatCurrency(paidOnCancelled.reduce((sum, t) => sum + t.amount, 0))}`],
    ['Completed rides with the payment still pending', `${unpaidCompleted.length} · ${formatCurrency(unpaidCompleted.reduce((sum, t) => sum + t.amount, 0))}`],
  ];

  const busiest = peakHours.filter((bucket) => bucket.count > 0);

  return {
    kind: 'report_rides',
    title: 'Rides and Revenue Summary',
    reference: input.periodLabel,
    status: 'Summary report',
    open: false,
    sections: [
      {
        heading: 'Summary',
        blocks: [
          {
            type: 'facts',
            rows: [
              ['Completed rides', `${summary.totalRides} (${change(summary.totalRidesDeltaPct, input.previousLabel)})`],
              ['Revenue', `${formatCurrency(summary.totalRevenue)} (${change(summary.totalRevenueDeltaPct, input.previousLabel)})`],
              ['Average fare', formatCurrency(summary.averageFare)],
              ['Busiest hours', summary.peakHourLabel],
            ],
          },
          { type: 'paragraph', text: 'Only completed rides are counted. Revenue is the paid payments of those rides. Times are Manila time.' },
        ],
      },
      methodRows.length > 0
        ? {
            heading: 'Payment methods',
            blocks: [
              { type: 'table', columns: ['Method', 'Paid payments', 'Amount'], widths: ['*', 90, 110], rows: methodRows },
              ...(input.transactionsTruncated
                ? [{ type: 'paragraph' as const, text: 'Based on the most recent 2,000 payments. Choose a shorter period for a complete breakdown.' }]
                : []),
            ],
          }
        : { heading: 'Payment methods', blocks: [], emptyText: 'No paid payments on completed rides in this period.' },
      daily.length > 0
        ? {
            heading: 'Rides and revenue by day',
            blocks: [{ type: 'table', columns: ['Day', 'Completed rides', 'Revenue'], widths: ['*', 110, 110], rows: daily.map((d) => [d.day, String(d.rides), formatCurrency(d.revenue)]) }],
          }
        : { heading: 'Rides and revenue by day', blocks: [], emptyText: 'No completed rides in this period.' },
      busiest.length > 0
        ? {
            heading: 'Busiest hours',
            blocks: [{ type: 'table', columns: ['Time of day', 'Completed rides'], widths: ['*', 110], rows: busiest.map((b) => [b.hourLabel, String(b.count)]) }],
          }
        : { heading: 'Busiest hours', blocks: [], emptyText: 'No completed rides in this period.' },
      { heading: 'Payment notes', blocks: [{ type: 'facts', rows: notes }] },
    ],
  };
}
