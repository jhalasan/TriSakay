import test from 'node:test';
import assert from 'node:assert/strict';
import { backStepIndex, clampStep, nextStepIndex, stepAt } from '../src/tutorial/TutorialProvider.ts';
import { clampArrowLeft, scaleFrame } from '../src/tutorial/geometry.ts';

const STEPS = [
  { screen: 'a', targetId: 'x', tip: 'below' as const, frame: { top: 0, left: 0, width: 10, height: 10, radius: 0 }, title: 'A', body: 'a' },
  { screen: 'b', targetId: 'y', tip: 'above' as const, frame: { top: 0, left: 0, width: 10, height: 10, radius: 0 }, title: 'B', body: 'b' },
];

test('clampStep keeps the index within [0, total+1]', () => {
  assert.equal(clampStep(-5, 2), 0);
  assert.equal(clampStep(0, 2), 0);
  assert.equal(clampStep(3, 2), 3);
  assert.equal(clampStep(99, 2), 3);
});

test('nextStepIndex advances by one, stopping at the finished toast (total+1)', () => {
  assert.equal(nextStepIndex(0, 2), 1);
  assert.equal(nextStepIndex(2, 2), 3);
  assert.equal(nextStepIndex(3, 2), 3);
});

test('backStepIndex retreats by one, stopping at the welcome sheet (0)', () => {
  assert.equal(backStepIndex(1, 2), 0);
  assert.equal(backStepIndex(0, 2), 0);
});

test('stepAt maps coach-mark steps (1..total) to the step table, and null elsewhere', () => {
  assert.equal(stepAt(STEPS, 0), null);
  assert.deepEqual(stepAt(STEPS, 1), STEPS[0]);
  assert.deepEqual(stepAt(STEPS, 2), STEPS[1]);
  assert.equal(stepAt(STEPS, 3), null);
});

test('scaleFrame scales a design-frame (390px-wide) rect linearly to the live screen width', () => {
  const frame = { top: 100, left: 20, width: 200, height: 50, radius: 10 };
  assert.deepEqual(scaleFrame(frame, 390), { x: 20, y: 100, width: 200, height: 50, radius: 10 });
  assert.deepEqual(scaleFrame(frame, 780), { x: 40, y: 200, width: 400, height: 100, radius: 20 });
});

test('clampArrowLeft points at the rect center relative to the tooltip, clamped to the design-frame 20..300 range', () => {
  // Rect centered well within the clamp range: arrow follows it exactly.
  assert.equal(clampArrowLeft(216, 16, 390), 200);
  // Rect far left: clamps to the 20px floor.
  assert.equal(clampArrowLeft(0, 16, 390), 20);
  // Rect far right: clamps to the 300px ceiling.
  assert.equal(clampArrowLeft(999, 16, 390), 300);
});
