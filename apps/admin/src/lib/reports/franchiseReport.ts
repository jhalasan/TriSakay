import type { TricycleRow } from '../../types/tricycle.ts';
import { daysUntilExpiry } from '../../types/tricycle.ts';
import { titleCaseLabel } from '../format.ts';
import { formatReportDate, formatReportDateShort, formatReportDateTime } from './format.ts';
import type { ReportModel } from './types.ts';

export interface FranchiseReportInput {
  tricycles: TricycleRow[];
  /** When the report is made. Expiry days are counted from the same moment. */
  asOfIso: string;
}

const dash = '—';

type Bucket = 'lapsed' | 'expiring' | 'none' | 'valid';

function bucketOf(days: number | null): Bucket {
  if (days === null) return 'none';
  if (days < 0) return 'lapsed';
  if (days <= 30) return 'expiring';
  return 'valid';
}

/** Short status text for the list: "Lapsed 12d ago", "Expires in 9d", "Valid, 200d left", "No expiry on file". */
export function expiryStatusText(days: number | null): string {
  if (days === null) return 'No expiry on file';
  if (days < 0) return `Lapsed ${Math.abs(days)}d ago`;
  if (days === 0) return 'Expires today';
  if (days <= 30) return `Expires in ${days}d`;
  return `Valid, ${days}d left`;
}

const BUCKET_ORDER: Record<Bucket, number> = { lapsed: 0, expiring: 1, none: 2, valid: 3 };

/**
 * Every tricycle with its MTOP franchise status, most urgent first (lapsed, then expiring within 30 days, then
 * no expiry on file, then valid). Supports Ordinance No. 21 and MTOP renewal follow-up.
 */
export function buildFranchiseReport(input: FranchiseReportInput): ReportModel {
  const rows = input.tricycles.map((t) => {
    const days = daysUntilExpiry(t.mtopExpiryDate);
    return { tricycle: t, days, bucket: bucketOf(days) };
  });

  rows.sort((a, b) => {
    if (BUCKET_ORDER[a.bucket] !== BUCKET_ORDER[b.bucket]) return BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket];
    if (a.days !== null && b.days !== null && a.days !== b.days) return a.days - b.days;
    return a.tricycle.plateNo.localeCompare(b.tricycle.plateNo);
  });

  const count = (bucket: Bucket) => rows.filter((r) => r.bucket === bucket).length;
  const verified = (status: TricycleRow['verificationStatus']) => input.tricycles.filter((t) => t.verificationStatus === status).length;

  return {
    kind: 'report_franchise',
    title: 'Franchise and Permit Status Report',
    reference: `As of ${formatReportDate(input.asOfIso)} · ${input.tricycles.length} active ${input.tricycles.length === 1 ? 'tricycle' : 'tricycles'}`,
    status: 'Summary report',
    open: false,
    sections: [
      {
        heading: 'Summary',
        blocks: [
          {
            type: 'facts',
            rows: [
              ['Lapsed franchises', String(count('lapsed'))],
              ['Expiring within 30 days', String(count('expiring'))],
              ['No expiry date on file', String(count('none'))],
              ['Valid (more than 30 days left)', String(count('valid'))],
              ['Verification', `${verified('approved')} approved · ${verified('pending')} pending · ${verified('rejected')} rejected · ${verified('unsubmitted')} not submitted`],
            ],
          },
          { type: 'paragraph', text: `Prepared ${formatReportDateTime(input.asOfIso)} (Manila time). Expiry days are counted from the date of this report.` },
        ],
      },
      rows.length > 0
        ? {
            heading: 'Tricycles by franchise status',
            blocks: [
              {
                type: 'table',
                columns: ['Plate no.', 'Tricycle ID', 'Cluster', 'Driver', 'MTOP no.', 'MTOP expiry', 'Status'],
                widths: [50, 40, 56, '*', 58, 60, 78],
                rows: rows.map(({ tricycle: t, days }) => [
                  t.plateNo || dash,
                  t.bodyNo || dash,
                  t.cluster ? titleCaseLabel(t.cluster) : dash,
                  t.driverName || dash,
                  t.mtopNo || dash,
                  t.mtopExpiryDate ? formatReportDateShort(`${t.mtopExpiryDate}T00:00:00+08:00`) : dash,
                  expiryStatusText(days),
                ]),
              },
            ],
          }
        : { heading: 'Tricycles by franchise status', blocks: [], emptyText: 'No active tricycles are registered.' },
    ],
  };
}
