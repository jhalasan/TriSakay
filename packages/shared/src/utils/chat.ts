/**
 * Ride comms redesign (Part C, `docs/design_handoff_trisakay_ride_comms`):
 * turns the raw `ride_messages` rows both chat screens already fetch into
 * the exact list the redesigned UI renders — day separators, client-derived
 * system pills (accepted/moved/arrived/ended — nothing is written to the
 * DB for these), and per-message grouping (consecutive same-sender bubbles
 * within a 3-minute window share a tail and a single trailing timestamp).
 * Pure and framework-free on purpose: both apps' screens call this with
 * their own `now`/locale and do their own i18n lookups from the `kind`
 * discriminators it returns — this module never touches `packages/shared`'s
 * translation strings directly.
 */

export type ChatMessageKind = 'text' | 'quick_reply' | 'image' | 'system';

export interface ChatSourceMessage {
  id: string;
  senderId: string;
  kind: ChatMessageKind;
  body: string | null;
  imagePath: string | null;
  containsMaskedPhone: boolean;
  createdAt: string;
  readAt: string | null;
}

/** Ride timestamps the screen already has on hand — nothing new is queried for these. */
export interface ChatRideEvents {
  acceptedAt?: string | null;
  /** D1 transfer — passenger side only (the old driver never sees this ride again). */
  driverChangedAt?: string | null;
  arrivedAt?: string | null;
  endedAt?: string | null;
  endedStatus?: 'completed' | 'cancelled' | null;
}

export type ChatSystemKind = 'accepted' | 'moved' | 'arrived' | 'completed' | 'cancelled' | 'raw';

export type ChatGroupPosition = 'single' | 'first' | 'middle' | 'last';

export interface ChatDayRow {
  type: 'day';
  id: string;
  /** 'today'/'yesterday' — the screen looks these up in its own i18n. A plain date renders as `dateLabel` as-is (already formatted, locale-aware, e.g. "SEP 28"). */
  day: 'today' | 'yesterday' | 'date';
  dateLabel?: string;
}

export interface ChatSystemRow {
  type: 'system';
  id: string;
  kind: ChatSystemKind;
  /** Raw ISO timestamp — the screen formats it with its own existing `formatTime`. */
  at: string;
  /** Only set when `kind === 'raw'` — a `kind:'system'` row that actually arrived from the DB (none are written today). Rendered verbatim instead of through an i18n template. */
  body?: string;
}

export interface ChatMessageRow<M extends ChatSourceMessage = ChatSourceMessage> {
  type: 'message';
  id: string;
  /** The exact object the caller passed in `messages` — typed `M` (not the narrower `ChatSourceMessage`) so callers get their own `RideMessage` type back untouched, extra fields and all. */
  message: M;
  sentByMe: boolean;
  groupPosition: ChatGroupPosition;
  /** Only the last bubble of a group carries the timestamp row underneath it. */
  showTimestamp: boolean;
  /** True on at most one row: the most recent sent message that has been read. */
  showSeen: boolean;
}

export interface ChatTypingRow {
  type: 'typing';
  id: 'typing';
}

export type ChatRow<M extends ChatSourceMessage = ChatSourceMessage> = ChatDayRow | ChatSystemRow | ChatMessageRow<M> | ChatTypingRow;

const GROUP_WINDOW_MS = 3 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/** Local calendar day, so "today"/"yesterday" match what the device's clock shows, not raw UTC. */
function dayKeyOf(ms: number): number {
  const d = new Date(ms);
  return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / DAY_MS);
}

function dayRowFor(ms: number, now: number, locale: string): ChatDayRow {
  const diff = dayKeyOf(now) - dayKeyOf(ms);
  const id = `day-${dayKeyOf(ms)}`;
  if (diff === 0) return { type: 'day', id, day: 'today' };
  if (diff === 1) return { type: 'day', id, day: 'yesterday' };
  const dateLabel = new Date(ms).toLocaleDateString(locale, { month: 'short', day: 'numeric' }).toUpperCase();
  return { type: 'day', id, day: 'date', dateLabel };
}

interface TimelineEntry<M extends ChatSourceMessage> {
  at: number;
  iso: string;
  message?: M;
  systemKind?: ChatSystemKind;
  systemBody?: string;
}

/**
 * Splits a masked message body on the literal `[phone number removed]`
 * marker `enforce_ride_message_insert_fields` writes server-side, so the
 * UI can render each occurrence as its own inline "number hidden" token
 * instead of leaving the marker text visible verbatim.
 */
export const MASKED_PHONE_MARKER = '[phone number removed]';

export type ChatTextSegment = { type: 'text'; value: string } | { type: 'maskedToken' };

export function splitMaskedPhoneBody(body: string): ChatTextSegment[] {
  if (!body.includes(MASKED_PHONE_MARKER)) return [{ type: 'text', value: body }];
  const parts = body.split(MASKED_PHONE_MARKER);
  const segments: ChatTextSegment[] = [];
  parts.forEach((part, i) => {
    if (part.length > 0) segments.push({ type: 'text', value: part });
    if (i < parts.length - 1) segments.push({ type: 'maskedToken' });
  });
  return segments;
}

export function buildChatRows<M extends ChatSourceMessage>(
  messages: M[],
  selfId: string,
  rideEvents: ChatRideEvents = {},
  options: { locale?: string; now?: number; otherPartyTyping?: boolean } = {},
): ChatRow<M>[] {
  const locale = options.locale ?? 'en-US';
  const now = options.now ?? Date.now();

  const timeline: TimelineEntry<M>[] = [];
  for (const m of messages) {
    // A `kind:'system'` row from the DB (none are written today, per the
    // C1 migration — this only guards the day nobody adds one) renders as
    // a pill with its own body, same as the client-derived ones below.
    if (m.kind === 'system') {
      timeline.push({ at: Date.parse(m.createdAt), iso: m.createdAt, systemKind: 'raw', systemBody: m.body ?? '' });
      continue;
    }
    timeline.push({ at: Date.parse(m.createdAt), iso: m.createdAt, message: m });
  }

  function pushEvent(at: string | null | undefined, kind: ChatSystemKind) {
    if (!at) return;
    timeline.push({ at: Date.parse(at), iso: at, systemKind: kind });
  }
  pushEvent(rideEvents.acceptedAt, 'accepted');
  pushEvent(rideEvents.driverChangedAt, 'moved');
  pushEvent(rideEvents.arrivedAt, 'arrived');
  if (rideEvents.endedAt && rideEvents.endedStatus) pushEvent(rideEvents.endedAt, rideEvents.endedStatus);

  timeline.sort((a, b) => a.at - b.at);

  const rows: ChatRow<M>[] = [];
  let lastDayKey: number | null = null;
  let prevMessage: M | null = null;
  let groupBroken = true;
  // Message rows are pushed with a provisional groupPosition of 'first' or
  // 'single' (i.e. "starts a group" vs not); a second pass below corrects
  // 'first'/'middle'/'last' once each row's neighbours are known.
  const messageRowIndices: number[] = [];
  const groupStarts: boolean[] = [];

  for (const entry of timeline) {
    const dk = dayKeyOf(entry.at);
    if (dk !== lastDayKey) {
      rows.push(dayRowFor(entry.at, now, locale));
      lastDayKey = dk;
      groupBroken = true;
    }

    if (entry.systemKind) {
      rows.push({ type: 'system', id: `sys-${entry.systemKind}-${entry.iso}`, kind: entry.systemKind, at: entry.iso, body: entry.systemBody });
      groupBroken = true;
      prevMessage = null;
      continue;
    }

    const m = entry.message!;
    const continuesGroup = !groupBroken && prevMessage !== null && prevMessage.senderId === m.senderId && entry.at - Date.parse(prevMessage.createdAt) <= GROUP_WINDOW_MS;

    messageRowIndices.push(rows.length);
    groupStarts.push(!continuesGroup);
    rows.push({
      type: 'message',
      id: m.id,
      message: m,
      sentByMe: m.senderId === selfId,
      groupPosition: 'single', // corrected below
      showTimestamp: false, // corrected below
      showSeen: false, // corrected below
    });

    prevMessage = m;
    groupBroken = false;
  }

  // Fix up groupPosition/showTimestamp now that each message row's
  // neighbours (in message-row order, not overall row order — a day
  // separator or system pill between two messages already broke the
  // group via `groupBroken` above) are known.
  for (let i = 0; i < messageRowIndices.length; i++) {
    const isStart = groupStarts[i];
    const isEnd = i === messageRowIndices.length - 1 || groupStarts[i + 1];
    const position: ChatGroupPosition = isStart && isEnd ? 'single' : isStart ? 'first' : isEnd ? 'last' : 'middle';
    const row = rows[messageRowIndices[i]] as ChatMessageRow<M>;
    row.groupPosition = position;
    row.showTimestamp = isEnd;
  }

  // "Seen" appears once: on the latest sent-by-me message that has been read.
  let latestSeenIndex = -1;
  let latestSeenAt = -Infinity;
  for (const idx of messageRowIndices) {
    const row = rows[idx] as ChatMessageRow<M>;
    if (row.sentByMe && row.message.readAt) {
      const at = Date.parse(row.message.createdAt);
      if (at > latestSeenAt) {
        latestSeenAt = at;
        latestSeenIndex = idx;
      }
    }
  }
  if (latestSeenIndex >= 0) (rows[latestSeenIndex] as ChatMessageRow<M>).showSeen = true;

  if (options.otherPartyTyping) rows.push({ type: 'typing', id: 'typing' });

  return rows;
}
