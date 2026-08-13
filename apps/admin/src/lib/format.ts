import { formatCurrency } from '@trisakay/utils';

export { formatCurrency };

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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
