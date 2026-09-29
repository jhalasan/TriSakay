import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChatRows, splitMaskedPhoneBody, type ChatRow, type ChatSourceMessage } from '../src/utils/chat.ts';

const NOW = Date.parse('2026-09-29T14:00:00+08:00');

function msg(id: string, senderId: string, atIso: string, extra: Partial<ChatSourceMessage> = {}): ChatSourceMessage {
  return {
    id,
    senderId,
    kind: 'text',
    body: `msg-${id}`,
    imagePath: null,
    containsMaskedPhone: false,
    createdAt: atIso,
    readAt: null,
    ...extra,
  };
}

function messageRows(rows: ChatRow[]) {
  return rows.filter((r): r is Extract<ChatRow, { type: 'message' }> => r.type === 'message');
}

test('groups consecutive same-sender messages within 3 minutes, tail on the last bubble only', () => {
  const rows = buildChatRows(
    [
      msg('a', 'driver', '2026-09-29T14:00:00+08:00'),
      msg('b', 'driver', '2026-09-29T14:01:00+08:00'),
      msg('c', 'driver', '2026-09-29T14:02:30+08:00'),
    ],
    'passenger',
    {},
    { now: NOW }
  );
  const msgs = messageRows(rows);
  assert.deepEqual(
    msgs.map((r) => [r.groupPosition, r.showTimestamp]),
    [
      ['first', false],
      ['middle', false],
      ['last', true],
    ]
  );
});

test('a gap over 3 minutes starts a new group', () => {
  const rows = messageRows(
    buildChatRows(
      [msg('a', 'driver', '2026-09-29T14:00:00+08:00'), msg('b', 'driver', '2026-09-29T14:04:00+08:00')],
      'passenger',
      {},
      { now: NOW }
    )
  );
  assert.deepEqual(rows.map((r) => r.groupPosition), ['single', 'single']);
  assert.deepEqual(rows.map((r) => r.showTimestamp), [true, true]);
});

test('a sender change always starts a new group even within the window', () => {
  const rows = messageRows(
    buildChatRows(
      [msg('a', 'driver', '2026-09-29T14:00:00+08:00'), msg('b', 'passenger', '2026-09-29T14:00:30+08:00')],
      'passenger',
      {},
      { now: NOW }
    )
  );
  assert.deepEqual(rows.map((r) => r.groupPosition), ['single', 'single']);
});

test('a single message with no neighbours is its own group', () => {
  const rows = messageRows(buildChatRows([msg('a', 'driver', '2026-09-29T14:00:00+08:00')], 'passenger', {}, { now: NOW }));
  assert.deepEqual(rows[0].groupPosition, 'single');
  assert.equal(rows[0].showTimestamp, true);
});

test('a system pill between two same-sender messages breaks the group even inside the time window', () => {
  const rows = buildChatRows(
    [msg('a', 'driver', '2026-09-29T14:00:00+08:00'), msg('b', 'driver', '2026-09-29T14:00:30+08:00')],
    'passenger',
    { arrivedAt: '2026-09-29T14:00:15+08:00' },
    { now: NOW }
  );
  const kinds = rows.map((r) => r.type);
  assert.deepEqual(kinds, ['day', 'message', 'system', 'message']);
  const msgs = messageRows(rows);
  assert.deepEqual(
    msgs.map((r) => r.groupPosition),
    ['single', 'single']
  );
});

test('only the single most recent read sent-by-me message shows Seen', () => {
  const rows = messageRows(
    buildChatRows(
      [
        msg('a', 'passenger', '2026-09-29T14:00:00+08:00', { readAt: '2026-09-29T14:00:05+08:00' }),
        msg('b', 'passenger', '2026-09-29T14:05:00+08:00', { readAt: '2026-09-29T14:05:05+08:00' }),
        msg('c', 'driver', '2026-09-29T14:06:00+08:00'),
      ],
      'passenger',
      {},
      { now: NOW }
    )
  );
  assert.deepEqual(
    rows.map((r) => r.showSeen),
    [false, true, false]
  );
});

test('an unread sent message and a received message never show Seen', () => {
  const rows = messageRows(
    buildChatRows(
      [msg('a', 'passenger', '2026-09-29T14:00:00+08:00'), msg('b', 'driver', '2026-09-29T14:01:00+08:00', { readAt: '2026-09-29T14:01:05+08:00' })],
      'passenger',
      {},
      { now: NOW }
    )
  );
  assert.deepEqual(
    rows.map((r) => r.showSeen),
    [false, false]
  );
});

test('day separators: today, yesterday, and an older formatted date', () => {
  const rows = buildChatRows(
    [
      msg('a', 'driver', '2026-09-27T10:00:00+08:00'),
      msg('b', 'driver', '2026-09-28T10:00:00+08:00'),
      msg('c', 'driver', '2026-09-29T10:00:00+08:00'),
    ],
    'passenger',
    {},
    { now: NOW, locale: 'en-US' }
  );
  const dayRows = rows.filter((r): r is Extract<ChatRow, { type: 'day' }> => r.type === 'day');
  assert.equal(dayRows.length, 3);
  assert.equal(dayRows[0].day, 'date');
  assert.equal(dayRows[0].dateLabel, 'SEP 27');
  assert.equal(dayRows[1].day, 'yesterday');
  assert.equal(dayRows[2].day, 'today');
});

test('client-derived system pills are inserted in chronological order among the messages', () => {
  const rows = buildChatRows(
    [msg('a', 'driver', '2026-09-29T14:05:00+08:00'), msg('b', 'passenger', '2026-09-29T14:10:00+08:00')],
    'passenger',
    { acceptedAt: '2026-09-29T14:00:00+08:00', arrivedAt: '2026-09-29T14:07:00+08:00' },
    { now: NOW }
  );
  const kinds = rows.map((r) => (r.type === 'system' ? `system:${r.kind}` : r.type));
  assert.deepEqual(kinds, ['day', 'system:accepted', 'message', 'system:arrived', 'message']);
});

test('ended pill uses the completed/cancelled kind from rideEvents', () => {
  const cancelledRows = buildChatRows([], 'passenger', { endedAt: '2026-09-29T14:00:00+08:00', endedStatus: 'cancelled' }, { now: NOW });
  const systemRow = cancelledRows.find((r): r is Extract<ChatRow, { type: 'system' }> => r.type === 'system');
  assert.equal(systemRow?.kind, 'cancelled');
});

test('a system-kind row from the DB renders as a raw pill with its own body', () => {
  const rows = buildChatRows(
    [msg('a', 'driver', '2026-09-29T14:00:00+08:00', { kind: 'system', body: 'Something happened' })],
    'passenger',
    {},
    { now: NOW }
  );
  const systemRow = rows.find((r): r is Extract<ChatRow, { type: 'system' }> => r.type === 'system');
  assert.equal(systemRow?.kind, 'raw');
  assert.equal(systemRow?.body, 'Something happened');
});

test('otherPartyTyping appends a trailing typing row', () => {
  const rows = buildChatRows([msg('a', 'driver', '2026-09-29T14:00:00+08:00')], 'passenger', {}, { now: NOW, otherPartyTyping: true });
  assert.equal(rows[rows.length - 1].type, 'typing');
});

test('splitMaskedPhoneBody returns the whole body as one text segment when there is no marker', () => {
  assert.deepEqual(splitMaskedPhoneBody('hello there'), [{ type: 'text', value: 'hello there' }]);
});

test('splitMaskedPhoneBody tokenizes a single masked occurrence', () => {
  assert.deepEqual(splitMaskedPhoneBody('call me at [phone number removed] ok?'), [
    { type: 'text', value: 'call me at ' },
    { type: 'maskedToken' },
    { type: 'text', value: ' ok?' },
  ]);
});

test('splitMaskedPhoneBody tokenizes multiple occurrences and a leading/trailing marker', () => {
  assert.deepEqual(splitMaskedPhoneBody('[phone number removed] or [phone number removed]'), [
    { type: 'maskedToken' },
    { type: 'text', value: ' or ' },
    { type: 'maskedToken' },
  ]);
});
