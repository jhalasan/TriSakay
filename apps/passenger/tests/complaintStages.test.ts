import test from 'node:test';
import assert from 'node:assert/strict';
import { getComplaintStageStates } from '../src/utils/complaintStages.ts';

test('open: received done, under review pending, resolution pending', () => {
  const stages = getComplaintStageStates('open');
  assert.equal(stages.underReview, 'pending');
  assert.equal(stages.resolution, 'pending');
});

test('under_review: under review current, resolution pending', () => {
  const stages = getComplaintStageStates('under_review');
  assert.equal(stages.underReview, 'current');
  assert.equal(stages.resolution, 'pending');
});

test('mediation_scheduled: under review current, resolution pending', () => {
  const stages = getComplaintStageStates('mediation_scheduled');
  assert.equal(stages.underReview, 'current');
  assert.equal(stages.resolution, 'pending');
});

test('escalated: under review current, resolution pending', () => {
  const stages = getComplaintStageStates('escalated');
  assert.equal(stages.underReview, 'current');
  assert.equal(stages.resolution, 'pending');
});

test('resolved: under review done, resolution done', () => {
  const stages = getComplaintStageStates('resolved');
  assert.equal(stages.underReview, 'done');
  assert.equal(stages.resolution, 'done');
});

test('dismissed: under review done, resolution done', () => {
  const stages = getComplaintStageStates('dismissed');
  assert.equal(stages.underReview, 'done');
  assert.equal(stages.resolution, 'done');
});
