import { manilaDateKey } from '../format.ts';
import { formatReportDate, formatReportDayMonth } from './format.ts';

export type ReportPeriodKey = '7d' | '30d' | 'quarter' | 'all';

export interface ReportPeriod {
  /** For the title band, e.g. "Last 30 days · 5 September to 5 October 2026". */
  label: string;
  /** For the audit trail, e.g. "Last 30 days". */
  short: string;
  /** For the change-since-last-period lines, e.g. "previous 30 days". */
  previousLabel: string;
  /** Start of the period, or null for all time. */
  sinceIso: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The period a summary report covers, with its wording. `now` can be passed so the result is predictable in tests. */
export function reportPeriod(key: ReportPeriodKey, now: Date = new Date()): ReportPeriod {
  const nowIso = now.toISOString();
  const end = formatReportDate(nowIso);

  if (key === 'all') {
    return { label: `All time · up to ${end}`, short: 'All time', previousLabel: 'the earlier period', sinceIso: null };
  }

  let sinceIso: string;
  let short: string;
  let previousLabel: string;
  if (key === 'quarter') {
    const [year, month] = manilaDateKey(now).split('-').map(Number);
    const startMonth = Math.floor((month - 1) / 3) * 3 + 1;
    sinceIso = `${year}-${String(startMonth).padStart(2, '0')}-01T00:00:00+08:00`;
    short = 'This quarter';
    previousLabel = 'previous quarter';
  } else {
    const days = key === '7d' ? 7 : 30;
    sinceIso = new Date(now.getTime() - days * DAY_MS).toISOString();
    short = `Last ${days} days`;
    previousLabel = `previous ${days} days`;
  }

  const sameYear = formatReportDate(sinceIso).slice(-4) === end.slice(-4);
  const start = sameYear ? formatReportDayMonth(sinceIso) : formatReportDate(sinceIso);
  return { label: `${short} · ${start} to ${end}`, short, previousLabel, sinceIso };
}
