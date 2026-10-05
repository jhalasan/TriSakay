const MANILA_TZ = 'Asia/Manila';

function manilaParts(iso: string, withTime: boolean) {
  const parts = new Intl.DateTimeFormat('en-PH', {
    timeZone: MANILA_TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit', hour12: true } : {}),
  }).formatToParts(new Date(iso));
  return (type: string) => parts.find((p) => p.type === type)?.value ?? '';
}

/** "5 October 2026, 3:15 PM" in Manila time, whatever time zone the browser is in. */
export function formatReportDateTime(iso: string): string {
  const get = manilaParts(iso, true);
  return `${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')} ${get('dayPeriod').toUpperCase()}`;
}

/** "5 October 2026" in Manila time. */
export function formatReportDate(iso: string): string {
  const get = manilaParts(iso, false);
  return `${get('day')} ${get('month')} ${get('year')}`;
}

/** "5 September" (no year) in Manila time, for the start of a period. */
export function formatReportDayMonth(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-PH', { timeZone: MANILA_TZ, day: 'numeric', month: 'long' }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')} ${get('month')}`;
}

/** "5 Oct 2026" in Manila time, for tables where a full month name would wrap. */
export function formatReportDateShort(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-PH', { timeZone: MANILA_TZ, day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')} ${get('month').replace('.', '')} ${get('year')}`;
}
