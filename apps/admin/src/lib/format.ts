import { formatCurrency } from '@trisakay/utils';

export { formatCurrency };

/**
 * P1-17 (2026-09-15 launch audit): converts a stored UTC timestamptz ISO
 * string to the "YYYY-MM-DDTHH:mm" value an `<input type="datetime-local">`
 * expects, using the browser's LOCAL time getters — not a plain
 * `.slice(0, 16)` off the ISO string, which took the raw UTC digits and let
 * the input silently reinterpret them as local time. Complaints.tsx's
 * mediation-meeting editor was doing exactly that, showing (and then, on
 * save, persisting) a time 8 hours off from the real UTC instant every time
 * an existing appointment was reopened and re-saved. `new Date(value)` on
 * an input's own "YYYY-MM-DDTHH:mm" value is always parsed as local time by
 * JS, so this is the correct inverse of that — the save path
 * (`new Date(meetingAtDraft).toISOString()`) was already right.
 */
export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** "Thursday, 8 September" — the Dashboard "Needs attention today" eyebrow date (no year, matches the mock). */
export function formatDayHeading(date: Date = new Date()): string {
  return date.toLocaleDateString('en-PH', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** snake_case / camelCase enum value -> "Title Case" label, e.g. 'under_review' -> 'Under Review'. */
export function titleCaseLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * The wireframe labels a Passenger's account_status='suspended' as
 * "Blocked" (Passenger Management screen), while the same enum value reads
 * "Suspended" everywhere else (Driver Management). Same DB value, two
 * wireframe-faithful labels.
 */
export function passengerStatusLabel(status: string): string {
  if (status === 'suspended') return 'Blocked';
  if (status === 'active') return 'Active';
  return titleCaseLabel(status);
}

/** 'cash' | 'gcash' -> "Cash" | "GCash" (titleCaseLabel would otherwise render "Gcash"). */
export function paymentMethodLabel(method: string): string {
  return method === 'gcash' ? 'GCash' : titleCaseLabel(method);
}

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/**
 * Mirrors the DB's `business_days_since()` exactly (counts Mon–Fri days
 * strictly after `startIso`'s date, up to and including today) so this
 * matches `v_overdue_complaints`'s numbers for the same complaint. Computed
 * client-side rather than one RPC call per row.
 */
export function businessDaysSince(startIso: string): number {
  const start = new Date(startIso);
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 1));
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  let count = 0;
  while (cursor <= end) {
    const isoDow = cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay(); // 1=Mon ... 7=Sun
    if (isoDow < 6) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

/** ISO timestamp -> 'Just now' / 'N min ago' / 'N hr ago' / 'N days ago', matching the wireframe's relative-time labels. */
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
