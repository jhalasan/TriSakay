/**
 * Pure helpers behind the trip-records / ratings redesign (docs/
 * design_handoff_trisakay_trip_records): document expiry status, rating-tag
 * splitting by score, tag counts, rating percentages and the complaint
 * status -> 3-step bar mapping. No React, no i18n — screens turn the results
 * into localized copy.
 */

// --- Documents (SPEC_1 §1b) -------------------------------------------------

export type DocumentStatus = 'expired' | 'expiring' | 'valid' | 'unset';

/** A document is "expiring" when it lapses within this many days. Unchanged from the pre-redesign screen. */
export const DOCUMENT_EXPIRING_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parses 'YYYY-MM-DD' (or an ISO timestamp's date part) as a UTC calendar day, so the day diff ignores time zones and DST. */
function toUtcDay(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function dateToUtcDay(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export interface DocumentExpiry {
  status: DocumentStatus;
  /** Whole calendar days until expiry (negative once expired). null when there is no usable date. */
  days: number | null;
}

/** expired if before today · expiring if 0..30 days out · valid beyond that · unset with no date. */
export function getDocumentExpiry(expiryDate: string | null | undefined, today: Date): DocumentExpiry {
  if (!expiryDate) return { status: 'unset', days: null };
  const expiryDay = toUtcDay(expiryDate);
  if (expiryDay === null) return { status: 'unset', days: null };
  const days = Math.round((expiryDay - dateToUtcDay(today)) / MS_PER_DAY);
  if (days < 0) return { status: 'expired', days };
  if (days <= DOCUMENT_EXPIRING_DAYS) return { status: 'expiring', days };
  return { status: 'valid', days };
}

const STATUS_ORDER: DocumentStatus[] = ['expired', 'expiring', 'valid', 'unset'];

export function countDocumentStatuses(statuses: DocumentStatus[]): Record<DocumentStatus, number> {
  const counts: Record<DocumentStatus, number> = { expired: 0, expiring: 0, valid: 0, unset: 0 };
  for (const status of statuses) counts[status] += 1;
  return counts;
}

/** Health-bar segments in the spec's order: expired -> expiring -> valid -> unset, one entry per document. */
export function documentHealthSegments(statuses: DocumentStatus[]): DocumentStatus[] {
  return [...statuses].sort((a, b) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b));
}

// --- Ratings (SPEC_3) -------------------------------------------------------

/** Mirrors the `rating_tag` enum's positive / negative split (RATING_TAGS in @trisakay/services keeps the canonical values). */
export const POSITIVE_RATING_TAGS = ['friendly', 'safe_driving', 'clean_vehicle', 'on_time'] as const;
export const NEGATIVE_RATING_TAGS = ['unsafe_driving', 'late', 'rude', 'poor_vehicle_condition'] as const;

export type PositiveRatingTag = (typeof POSITIVE_RATING_TAGS)[number];
export type NegativeRatingTag = (typeof NEGATIVE_RATING_TAGS)[number];
export type AnyRatingTag = PositiveRatingTag | NegativeRatingTag;

/** A rating of this score or lower offers the "Something serious? Report" card (SPEC_3 §3a-P). */
export const REPORT_PROMPT_MAX_SCORE = 2;

export type ScoreTone = 'danger' | 'navy' | 'green';

/** 1-2 red, 3 navy, 4-5 green — the star and score-word colour on the rate page and rating cards. */
export function scoreTone(score: number): ScoreTone {
  if (score <= 2) return 'danger';
  if (score === 3) return 'navy';
  return 'green';
}

/** 4-5 stars -> the positive tags; 1-3 -> the negative ones (SPEC_3 §3a-P). */
export function tagsForScore(score: number): readonly AnyRatingTag[] {
  return score >= 4 ? POSITIVE_RATING_TAGS : NEGATIVE_RATING_TAGS;
}

/** Drops tags that no longer apply after the score changes. */
export function pruneTagsForScore<T extends string>(selected: readonly T[], score: number): T[] {
  const allowed = tagsForScore(score) as readonly string[];
  return selected.filter((tag) => allowed.includes(tag));
}

export function isPositiveRatingTag(tag: string): boolean {
  return (POSITIVE_RATING_TAGS as readonly string[]).includes(tag);
}

export interface TagCount {
  tag: string;
  count: number;
  positive: boolean;
}

/** "What passengers mention": positive tags first by count desc, then negative by count desc. Zero-count tags are omitted. */
export function countRatingTags(ratings: ReadonlyArray<{ tags: readonly string[] }>): TagCount[] {
  const counts = new Map<string, number>();
  for (const rating of ratings) {
    for (const tag of rating.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const rows: TagCount[] = [...counts].map(([tag, count]) => ({ tag, count, positive: isPositiveRatingTag(tag) }));
  return rows.sort((a, b) => {
    if (a.positive !== b.positive) return a.positive ? -1 : 1;
    return b.count - a.count;
  });
}

/**
 * Whole-number percentages for the rating distribution bars that sum to
 * exactly 100 (largest remainder), or all zeros when there are no ratings.
 * The output keeps the input's order.
 */
export function ratingPercentages(distribution: readonly number[]): number[] {
  const total = distribution.reduce((sum, n) => sum + n, 0);
  if (total === 0) return distribution.map(() => 0);
  const exact = distribution.map((n) => (n / total) * 100);
  const floors = exact.map(Math.floor);
  let remaining = 100 - floors.reduce((sum, n) => sum + n, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - floors[index] }))
    .sort((a, b) => b.remainder - a.remainder);
  for (const { index } of byRemainder) {
    if (remaining <= 0) break;
    floors[index] += 1;
    remaining -= 1;
  }
  return floors;
}

// --- Complaints (SPEC_1 §1c) ------------------------------------------------

export type ComplaintStep = 0 | 1 | 2;

/** open -> Open · under_review / escalated / mediation_scheduled -> Under review · resolved / dismissed -> Closed. */
export function complaintStepIndex(status: string): ComplaintStep {
  switch (status) {
    case 'open':
      return 0;
    case 'resolved':
    case 'dismissed':
      return 2;
    default:
      return 1;
  }
}

// --- Trip details formatting (SPEC_1 §1a) -----------------------------------

/** "Thu, Aug 28, 2026" (or "Fri, Sep 12" with `includeYear: false`) — the hero date line, minus the time. */
export function formatDetailDate(iso: string, includeYear = true): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
}

/** "4:12 PM" */
export function formatClockTime(date: Date | string): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  return value.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

/** A copy of `iso` shifted `minutes` earlier — the derived pickup time (history `date` is the ride's end). */
export function minutesBefore(iso: string, minutes: number): Date {
  return new Date(new Date(iso).getTime() - minutes * 60 * 1000);
}

// --- Change password (SPEC_2 §2b) --------------------------------------------

/** The three rules the Change password checklist shows, in display order. */
export function passwordRuleResults(password: string): [boolean, boolean, boolean] {
  return [
    password.length >= 10,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /[0-9]/.test(password) || /[^A-Za-z0-9\s]/.test(password),
  ];
}
