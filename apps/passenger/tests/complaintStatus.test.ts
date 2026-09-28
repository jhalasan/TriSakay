import test from 'node:test';
import assert from 'node:assert/strict';
import { getStageBarColors, isTerminalStatus, STATUS_CHIP_TONE } from '../src/utils/complaintStatus.ts';

// Hardcoded rather than imported from @trisakay/ui: that package's barrel
// uses extensionless directory imports that plain `node --test` (no
// bundler/tsx loader, unlike this app's other tests) can't resolve as ESM.
// Values copied verbatim from packages/ui/src/theme/colors.ts.
const colors = {
  accentGreen: '#477434',
  accentBlue: '#002E60',
  line: '#DCE2E6',
  lineStrong: '#838B91',
  accentBlueSoft: '#E3EDF7',
};

const ALL_STATUSES = ['open', 'under_review', 'mediation_scheduled', 'escalated', 'resolved', 'dismissed'] as const;

test('every status has a chip tone', () => {
  for (const status of ALL_STATUSES) {
    assert.ok(STATUS_CHIP_TONE[status].bg);
    assert.ok(STATUS_CHIP_TONE[status].fg);
  }
});

test('under_review chip is blue, never green', () => {
  assert.equal(STATUS_CHIP_TONE.under_review.bg, colors.accentBlueSoft);
});

test('open: segment1 green, segment2 pending, segment3 pending', () => {
  const bar = getStageBarColors('open');
  assert.equal(bar.segment1, colors.accentGreen);
  assert.equal(bar.segment2, colors.line);
  assert.equal(bar.segment3, colors.line);
});

test('under_review: segment2 is current blue', () => {
  const bar = getStageBarColors('under_review');
  assert.equal(bar.segment2, colors.accentBlue);
  assert.equal(bar.segment3, colors.line);
});

test('mediation_scheduled: segment2 is current blue', () => {
  const bar = getStageBarColors('mediation_scheduled');
  assert.equal(bar.segment2, colors.accentBlue);
});

test('escalated: segment2 is current blue', () => {
  const bar = getStageBarColors('escalated');
  assert.equal(bar.segment2, colors.accentBlue);
});

test('resolved: all segments done green', () => {
  const bar = getStageBarColors('resolved');
  assert.equal(bar.segment1, colors.accentGreen);
  assert.equal(bar.segment2, colors.accentGreen);
  assert.equal(bar.segment3, colors.accentGreen);
});

test('dismissed: segment3 uses the dismissed tone, not green', () => {
  const bar = getStageBarColors('dismissed');
  assert.equal(bar.segment1, colors.accentGreen);
  assert.equal(bar.segment2, colors.accentGreen);
  assert.equal(bar.segment3, colors.lineStrong);
});

test('isTerminalStatus', () => {
  assert.equal(isTerminalStatus('resolved'), true);
  assert.equal(isTerminalStatus('dismissed'), true);
  assert.equal(isTerminalStatus('open'), false);
  assert.equal(isTerminalStatus('under_review'), false);
  assert.equal(isTerminalStatus('escalated'), false);
  assert.equal(isTerminalStatus('mediation_scheduled'), false);
});
