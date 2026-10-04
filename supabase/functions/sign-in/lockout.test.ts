// Run with: node --test supabase/functions/sign-in/lockout.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCK_WINDOW_MS,
  MAX_FAILED_ATTEMPTS,
  failuresSinceLastSuccess,
  ipIsThrottled,
  lockMessage,
  lockState,
  normalizeEmail,
} from './lockout.ts';

const now = Date.UTC(2026, 9, 4, 12, 0, 0);
const minutesAgo = (m: number) => now - m * 60_000;

test('fewer than five recent failures leaves the account open and counts the attempts left', () => {
  const state = lockState([minutesAgo(1), minutesAgo(2), minutesAgo(3)], now);

  assert.equal(state.locked, false);
  assert.equal(state.attemptsLeft, MAX_FAILED_ATTEMPTS - 3);
  assert.equal(state.retryAfterSeconds, 0);
});

test('five failures inside the window lock the account until the oldest one ages out', () => {
  const state = lockState([minutesAgo(1), minutesAgo(2), minutesAgo(3), minutesAgo(4), minutesAgo(10)], now);

  assert.equal(state.locked, true);
  assert.equal(state.attemptsLeft, 0);
  // the oldest counted failure is 10 minutes old, so it leaves the 15 minute window in 5 minutes
  assert.equal(state.retryAfterSeconds, 5 * 60);
});

test('failures older than the window are ignored', () => {
  const old = now - LOCK_WINDOW_MS - 1000;
  const state = lockState([old, old, old, old, old, minutesAgo(1)], now);

  assert.equal(state.locked, false);
  assert.equal(state.attemptsLeft, MAX_FAILED_ATTEMPTS - 1);
});

test('a successful sign in clears the earlier failures', () => {
  // newest first, as the database returns them
  const rows = [
    { success: false, createdAtMs: minutesAgo(1) },
    { success: true, createdAtMs: minutesAgo(2) },
    { success: false, createdAtMs: minutesAgo(3) },
    { success: false, createdAtMs: minutesAgo(4) },
  ];

  assert.deepEqual(failuresSinceLastSuccess(rows), [minutesAgo(1)]);
});

test('the lock message says how many minutes to wait, rounded up', () => {
  assert.equal(lockMessage(5 * 60), 'Too many failed sign in attempts. Try again in 5 minutes.');
  assert.equal(lockMessage(61), 'Too many failed sign in attempts. Try again in 2 minutes.');
  assert.equal(lockMessage(30), 'Too many failed sign in attempts. Try again in 1 minute.');
});

test('one network cannot send an unlimited number of attempts', () => {
  assert.equal(ipIsThrottled(5), false);
  assert.equal(ipIsThrottled(40), true);
});

test('emails are compared without case or surrounding spaces', () => {
  assert.equal(normalizeEmail('  Jay@Example.COM '), 'jay@example.com');
});
