import test from 'node:test';
import assert from 'node:assert/strict';
import { moderateScale } from '../src/theme/scale.ts';

test('moderateScale returns the input unchanged at the 375px baseline width', () => {
  assert.equal(moderateScale(16, 375), 16);
});

test('moderateScale shrinks values on a narrower screen, damped by factor', () => {
  // ratio = 320/375 ≈ 0.8533; halfway between 16 and 16*ratio ≈ 13.65 is ≈ 14.83
  const result = moderateScale(16, 320);
  assert.ok(result < 16 && result > 14, `expected ~14.83, got ${result}`);
});

test('moderateScale grows values on a wider screen, damped by factor', () => {
  // ratio = 428/375 ≈ 1.1413; halfway between 16 and 16*ratio ≈ 18.26 is ≈ 17.13
  const result = moderateScale(16, 428);
  assert.ok(result > 16 && result < 19, `expected ~17.13, got ${result}`);
});

test('a factor of 0 leaves the size untouched regardless of width', () => {
  assert.equal(moderateScale(24, 320, 0), 24);
});

test('a factor of 1 applies the raw width ratio with no damping', () => {
  const result = moderateScale(16, 320, 1);
  assert.ok(Math.abs(result - (16 * (320 / 375))) < 1e-9);
});
