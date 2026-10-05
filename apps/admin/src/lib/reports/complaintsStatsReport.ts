import type { ComplaintCategory, ComplaintRow, ComplaintStatus } from '../../types/complaint.ts';
import { getReferenceCode, titleCaseLabel } from '../format.ts';
import { formatReportDateShort } from './format.ts';
import type { ReportModel } from './types.ts';

export interface ComplaintsStatsReportInput {
  complaints: ComplaintRow[];
  /** e.g. "Last 30 days · 6 September to 5 October 2026". */
  periodLabel: string;
  /** Complaints filed at or after this moment are included; null means all time. */
  sinceIso: string | null;
}

/** The printed list stops here, with a note, so a long period does not make a very long document. */
export const COMPLAINT_LIST_CAP = 200;

const STATUSES: ComplaintStatus[] = ['open', 'under_review', 'escalated', 'mediation_scheduled', 'resolved', 'dismissed'];
const CATEGORIES: ComplaintCategory[] = ['fare', 'conduct', 'safety', 'low_rating', 'vehicle_condition', 'other'];
const ARTA_TARGET_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

function isClosed(status: ComplaintStatus): boolean {
  return status === 'resolved' || status === 'dismissed';
}

function shorten(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Complaints filed in the period: how many, how they stand, how fast they close, and the list itself. */
export function buildComplaintsStatsReport(input: ComplaintsStatsReportInput): ReportModel {
  const since = input.sinceIso ? new Date(input.sinceIso).getTime() : null;
  const inPeriod = input.complaints
    .filter((c) => since === null || new Date(c.createdAt).getTime() >= since)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const closed = inPeriod.filter((c) => isClosed(c.status));
  const open = inPeriod.length - closed.length;
  const overdue = inPeriod.filter((c) => (c.status === 'open' || c.status === 'under_review') && c.businessDaysElapsed > ARTA_TARGET_DAYS).length;
  const unassigned = inPeriod.filter((c) => !isClosed(c.status) && c.assignedToId === null).length;

  const closeTimes = closed.filter((c) => c.resolvedAt).map((c) => (new Date(c.resolvedAt!).getTime() - new Date(c.createdAt).getTime()) / DAY_MS);
  const averageDays = closeTimes.length > 0 ? `${(closeTimes.reduce((sum, d) => sum + d, 0) / closeTimes.length).toFixed(1)} days` : 'Not available yet';

  const listed = inPeriod.slice(0, COMPLAINT_LIST_CAP);

  return {
    kind: 'report_complaints',
    title: 'Complaints Statistics Report',
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
              ['Complaints filed', String(inPeriod.length)],
              ['Still open', String(open)],
              ['Closed (resolved or dismissed)', String(closed.length)],
              [`Overdue (more than ${ARTA_TARGET_DAYS} business days, not yet handled)`, String(overdue)],
              ['Open and not owned by anyone', String(unassigned)],
              ['Average time to close', averageDays],
            ],
          },
        ],
      },
      {
        heading: 'By status',
        blocks: [
          {
            type: 'table',
            columns: ['Status', 'Complaints'],
            widths: ['*', 110],
            rows: STATUSES.map((status) => [titleCaseLabel(status), String(inPeriod.filter((c) => c.status === status).length)]),
          },
        ],
      },
      {
        heading: 'By category',
        blocks: [
          {
            type: 'table',
            columns: ['Category', 'Complaints'],
            widths: ['*', 110],
            rows: CATEGORIES.map((category) => [titleCaseLabel(category), String(inPeriod.filter((c) => c.category === category).length)]),
          },
        ],
      },
      listed.length > 0
        ? {
            heading: 'Complaints in this period',
            blocks: [
              {
                type: 'table',
                columns: ['Ref.', 'Filed', 'Category', 'Subject', 'Status', 'Owner', 'Days'],
                widths: [34, 56, 56, '*', 68, 70, 26],
                rows: listed.map((c) => [
                  `#${getReferenceCode(c.id, 4) ?? '—'}`,
                  formatReportDateShort(c.createdAt),
                  titleCaseLabel(c.category),
                  shorten(c.subject, 60),
                  titleCaseLabel(c.status),
                  c.assignedToName ?? 'Unassigned',
                  String(c.businessDaysElapsed),
                ]),
              },
              ...(inPeriod.length > listed.length
                ? [{ type: 'paragraph' as const, text: `Showing the ${listed.length} most recent of ${inPeriod.length} complaints. Choose a shorter period to see the rest.` }]
                : []),
              { type: 'paragraph' as const, text: 'Days is business days since the complaint was filed.' },
            ],
          }
        : { heading: 'Complaints in this period', blocks: [], emptyText: 'No complaints were filed in this period.' },
    ],
  };
}
