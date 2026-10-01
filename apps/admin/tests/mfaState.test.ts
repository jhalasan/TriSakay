import test from 'node:test';
import assert from 'node:assert/strict';
import { nextMfaStep } from '../src/lib/mfaState.ts';

test('no factor means the user must enrol', () => {
  assert.equal(nextMfaStep({ enrolled: false, needsChallenge: false }), 'enroll');
});

test('a factor at password-only level means the user must enter a code', () => {
  assert.equal(nextMfaStep({ enrolled: true, needsChallenge: true }), 'challenge');
});

test('a factor and a code-verified session is fine', () => {
  assert.equal(nextMfaStep({ enrolled: true, needsChallenge: false }), 'ok');
});
