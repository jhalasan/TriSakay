import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDiscountLabel } from '../src/passenger-stats/formatDiscountLabel.ts';

const labels = { seniorCitizen: 'Senior', pwd: 'PWD', student: 'Student' };

test('formats a student discount at the given rate', () => {
  assert.equal(formatDiscountLabel('student', 20, labels), 'Student 20%');
});

test('formats a senior citizen discount', () => {
  assert.equal(formatDiscountLabel('senior_citizen', 20, labels), 'Senior 20%');
});

test('formats a PWD discount', () => {
  assert.equal(formatDiscountLabel('pwd', 20, labels), 'PWD 20%');
});
