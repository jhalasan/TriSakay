import test from 'node:test';
import assert from 'node:assert/strict';
import { businessDaysSince, daysFromTodayManila, manilaDateKey } from '../src/lib/format.ts';
import { daysUntilExpiry } from '../src/types/tricycle.ts';

test('manilaDateKey uses the Manila calendar day, not the UTC one', () => {
  // 17:00 UTC on Oct 3 is 01:00 on Oct 4 in Manila.
  assert.equal(manilaDateKey('2026-10-03T17:00:00.000Z'), '2026-10-04');
  // 15:59 UTC on Oct 3 is still Oct 3 in Manila (23:59).
  assert.equal(manilaDateKey('2026-10-03T15:59:00.000Z'), '2026-10-03');
});

test('daysFromTodayManila counts whole days against today in Manila', () => {
  const today = manilaDateKey();
  const shift = (days: number) => new Date(Date.parse(today) + days * 86_400_000).toISOString().slice(0, 10);
  assert.equal(daysFromTodayManila(today), 0);
  assert.equal(daysFromTodayManila(shift(30)), 30);
  assert.equal(daysFromTodayManila(shift(-5)), -5);
});

test('daysUntilExpiry is null with no date and otherwise follows Manila today', () => {
  assert.equal(daysUntilExpiry(null), null);
  assert.equal(daysUntilExpiry(manilaDateKey()), 0);
});

test('businessDaysSince counts nothing for a complaint filed today (Manila) and is never negative', () => {
  assert.equal(businessDaysSince(new Date().toISOString()), 0);
  assert.ok(businessDaysSince('2020-01-01T00:00:00.000Z') > 1000);
});
