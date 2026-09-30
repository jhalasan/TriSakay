import test from 'node:test';
import assert from 'node:assert/strict';
import {
  complaintStepIndex,
  countDocumentStatuses,
  countRatingTags,
  documentHealthSegments,
  getDocumentExpiry,
  pruneTagsForScore,
  ratingPercentages,
  scoreTone,
  tagsForScore,
  type DocumentStatus,
} from '../src/utils/records.ts';

const TODAY = new Date(2026, 8, 30); // Sep 30 2026, local

test('getDocumentExpiry: unset when there is no usable date', () => {
  assert.deepEqual(getDocumentExpiry(null, TODAY), { status: 'unset', days: null });
  assert.deepEqual(getDocumentExpiry('garbage', TODAY), { status: 'unset', days: null });
});

test('getDocumentExpiry: expired, expiring boundaries and valid', () => {
  assert.deepEqual(getDocumentExpiry('2026-09-29', TODAY), { status: 'expired', days: -1 });
  assert.deepEqual(getDocumentExpiry('2026-09-30', TODAY), { status: 'expiring', days: 0 });
  assert.deepEqual(getDocumentExpiry('2026-10-30', TODAY), { status: 'expiring', days: 30 });
  assert.deepEqual(getDocumentExpiry('2026-10-31', TODAY), { status: 'valid', days: 31 });
});

test('getDocumentExpiry ignores the time part of an ISO timestamp', () => {
  assert.equal(getDocumentExpiry('2026-10-14T00:00:00Z', TODAY).days, 14);
});

test('health segments order expired -> expiring -> valid -> unset and counts add up', () => {
  const statuses: DocumentStatus[] = ['valid', 'unset', 'expired', 'valid', 'expiring'];
  assert.deepEqual(documentHealthSegments(statuses), ['expired', 'expiring', 'valid', 'valid', 'unset']);
  assert.deepEqual(countDocumentStatuses(statuses), { expired: 1, expiring: 1, valid: 2, unset: 1 });
});

test('tagsForScore splits positive (4-5) from negative (1-3)', () => {
  assert.deepEqual([...tagsForScore(5)], ['friendly', 'safe_driving', 'clean_vehicle', 'on_time']);
  assert.deepEqual([...tagsForScore(4)], [...tagsForScore(5)]);
  assert.deepEqual([...tagsForScore(3)], ['unsafe_driving', 'late', 'rude', 'poor_vehicle_condition']);
  assert.deepEqual([...tagsForScore(1)], [...tagsForScore(3)]);
});

test('pruneTagsForScore clears tags that no longer apply', () => {
  assert.deepEqual(pruneTagsForScore(['friendly', 'on_time'], 2), []);
  assert.deepEqual(pruneTagsForScore(['late', 'rude'], 5), []);
  assert.deepEqual(pruneTagsForScore(['friendly', 'on_time'], 4), ['friendly', 'on_time']);
});

test('scoreTone: 1-2 danger, 3 navy, 4-5 green', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(scoreTone), ['danger', 'danger', 'navy', 'green', 'green']);
});

test('countRatingTags lists positive first by count, then negative by count', () => {
  const rows = countRatingTags([
    { tags: ['late', 'friendly'] },
    { tags: ['late'] },
    { tags: ['friendly', 'on_time'] },
    { tags: ['friendly'] },
    { tags: [] },
  ]);
  assert.deepEqual(
    rows.map((r) => [r.tag, r.count, r.positive]),
    [
      ['friendly', 3, true],
      ['on_time', 1, true],
      ['late', 2, false],
    ],
  );
  assert.deepEqual(countRatingTags([{ tags: [] }]), []);
});

test('ratingPercentages sums to exactly 100 and handles an empty distribution', () => {
  assert.equal(ratingPercentages([1, 1, 1]).reduce((a, b) => a + b, 0), 100);
  assert.deepEqual(ratingPercentages([0, 0, 0, 0, 0]), [0, 0, 0, 0, 0]);
  assert.deepEqual(ratingPercentages([0, 0, 0, 0, 4]), [0, 0, 0, 0, 100]);
});

test('complaintStepIndex maps the six statuses onto the three-step bar', () => {
  assert.equal(complaintStepIndex('open'), 0);
  assert.equal(complaintStepIndex('under_review'), 1);
  assert.equal(complaintStepIndex('escalated'), 1);
  assert.equal(complaintStepIndex('mediation_scheduled'), 1);
  assert.equal(complaintStepIndex('resolved'), 2);
  assert.equal(complaintStepIndex('dismissed'), 2);
});

test('passwordRuleResults checks length, mixed case, and a number or symbol', async () => {
  const { passwordRuleResults } = await import('../src/utils/records.ts');
  assert.deepEqual(passwordRuleResults(''), [false, false, false]);
  assert.deepEqual(passwordRuleResults('abcdefghij'), [true, false, false]);
  assert.deepEqual(passwordRuleResults('Abcdefghij'), [true, true, false]);
  assert.deepEqual(passwordRuleResults('Abcdefghi1'), [true, true, true]);
  assert.deepEqual(passwordRuleResults('Abcdef!'), [false, true, true]);
});
