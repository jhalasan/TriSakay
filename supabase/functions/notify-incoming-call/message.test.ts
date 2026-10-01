// Run with: node --test supabase/functions/notify-incoming-call/message.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { incomingCallTitle, isFreshRing } from './message.ts';

test('the push names only the caller\'s role, never a name or number', () => {
  assert.equal(incomingCallTitle(true), 'Incoming call from your driver');
  assert.equal(incomingCallTitle(false), 'Incoming call from your passenger');
});

test('a ring is only worth a push for the first minute', () => {
  const now = Date.parse('2026-10-01T10:00:00Z');
  assert.equal(isFreshRing('2026-10-01T09:59:30Z', now), true);
  assert.equal(isFreshRing('2026-10-01T09:58:30Z', now), false);
  assert.equal(isFreshRing('not a date', now), false);
});
