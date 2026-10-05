import test from 'node:test';
import assert from 'node:assert/strict';
import { formatReportDate, formatReportDateTime } from '../src/lib/reports/format.ts';

test('formatReportDateTime shows Manila time with a capital AM or PM', () => {
  // 07:15 UTC is 3:15 PM in Manila (UTC+8).
  assert.equal(formatReportDateTime('2026-10-05T07:15:00.000Z'), '5 October 2026, 3:15 PM');
  assert.equal(formatReportDateTime('2026-10-05T00:05:00.000Z'), '5 October 2026, 8:05 AM');
});

test('formatReportDateTime uses the Manila day, not the UTC day', () => {
  // 17:00 UTC on 4 October is already 1:00 AM on 5 October in Manila.
  assert.equal(formatReportDateTime('2026-10-04T17:00:00.000Z'), '5 October 2026, 1:00 AM');
  assert.equal(formatReportDateTime('2026-10-04T15:59:00.000Z'), '4 October 2026, 11:59 PM');
});

test('formatReportDate drops the time', () => {
  assert.equal(formatReportDate('2026-10-05T07:15:00.000Z'), '5 October 2026');
});
