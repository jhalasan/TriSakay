import test from 'node:test';
import assert from 'node:assert/strict';
import { colors } from '../src/theme/colors.ts';
import { spacing } from '../src/theme/spacing.ts';
import { radius } from '../src/theme/radius.ts';
import { typography } from '../src/theme/typography.ts';
import { motion } from '../src/theme/motion.ts';

test('colors.accentBlueDeep matches the spec navy-ink stop', () => {
  assert.equal(colors.accentBlueDeep, '#001A38');
});

test('spacing exposes the redesign-specific steps at the 375px baseline', () => {
  assert.equal(spacing.tight2, 2);
  assert.equal(spacing.tight6, 6);
  assert.equal(spacing.tight10, 10);
  assert.equal(spacing.tight14, 14);
  assert.equal(spacing.tight18, 18);
  assert.equal(spacing.tight22, 22);
  assert.equal(spacing.tight26, 26);
  assert.equal(spacing.tight34, 34);
  assert.equal(spacing.tight44, 44);
});

test('radius exposes the redesign-specific steps at the 375px baseline', () => {
  assert.equal(radius.xs, 11);
  assert.equal(radius.sm2, 14);
  assert.equal(radius.md3, 18);
  assert.equal(radius.lg2, 22);
  assert.equal(radius.xl2, 24);
  assert.equal(radius.heroBottom, 30);
});

test('typography exposes the redesign-specific type styles', () => {
  assert.equal(typography.h1b.fontSize, 28);
  assert.equal(typography.h1b.fontFamily, 'Poppins_800ExtraBold');
  assert.equal(typography.h2b.fontSize, 22);
  assert.equal(typography.h3b.fontSize, 19);
  assert.equal(typography.bodyLg.fontSize, 15);
  assert.equal(typography.bodySm.fontSize, 14);
  assert.equal(typography.labelSm.fontSize, 11);
  assert.equal(typography.labelXs.fontSize, 10);
  assert.equal(typography.eyebrow.fontSize, 12);
  assert.equal(typography.eyebrow.textTransform, 'uppercase');
});

test('motion exposes the two redesign pulse durations', () => {
  assert.equal(motion.duration.pulseStatus, 2000);
  assert.equal(motion.duration.pulseListening, 2400);
});
