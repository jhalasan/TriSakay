/** Turns a session's user-agent into something a person can recognise. `text` is only set for 'other'. */
export function describeDevice(userAgent: string | null | undefined): { kind: 'android' | 'unknown' | 'other'; text: string } {
  if (!userAgent) return { kind: 'unknown', text: '' };
  if (/okhttp|dalvik|expo/i.test(userAgent)) return { kind: 'android', text: '' };
  return { kind: 'other', text: userAgent.slice(0, 40) };
}

/** Short relative time for a "last active" line: now, 15m, 3h, 3d. Empty when the date is unusable. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.floor((now.getTime() - then) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
