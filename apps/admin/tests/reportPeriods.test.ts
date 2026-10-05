import test from 'node:test';
import assert from 'node:assert/strict';
import { reportPeriod } from '../src/lib/reports/periods.ts';

const NOW = new Date('2026-10-05T07:15:00.000Z'); // 5 October 2026, 3:15 PM in Manila

test('a 30 day period names the dates and the previous period', () => {
  const period = reportPeriod('30d', NOW);
  assert.equal(period.label, 'Last 30 days · 5 September to 5 October 2026');
  assert.equal(period.short, 'Last 30 days');
  assert.equal(period.previousLabel, 'previous 30 days');
  assert.equal(period.sinceIso, new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString());
});

test('a 7 day period', () => {
  const period = reportPeriod('7d', NOW);
  assert.equal(period.label, 'Last 7 days · 28 September to 5 October 2026');
  assert.equal(period.previousLabel, 'previous 7 days');
});

test('this quarter starts on the first day of the quarter', () => {
  const period = reportPeriod('quarter', NOW);
  assert.equal(period.short, 'This quarter');
  assert.match(period.label, /^This quarter · 1 October to 5 October 2026$/);
  assert.equal(period.previousLabel, 'previous quarter');
});

test('all time has no start date', () => {
  const period = reportPeriod('all', NOW);
  assert.equal(period.sinceIso, null);
  assert.equal(period.label, 'All time · up to 5 October 2026');
});
