import test from 'node:test';
import assert from 'node:assert/strict';
import { maskEmail, maskPhone } from '../src/utils/mask.ts';

test('maskEmail keeps the first letter and the domain', () => {
  assert.equal(maskEmail('juan@gmail.com'), 'j***@gmail.com');
  assert.equal(maskEmail('a@b.co'), 'a***@b.co');
});

test('maskEmail handles missing or malformed input', () => {
  assert.equal(maskEmail(null), '—');
  assert.equal(maskEmail(undefined), '—');
  assert.equal(maskEmail(''), '—');
  assert.equal(maskEmail('not-an-email'), '•••');
});

test('maskPhone keeps only the last 4 digits', () => {
  assert.equal(maskPhone('09171234567'), '09•• ••• 4567');
  assert.equal(maskPhone('0922 444 4955'), '09•• ••• 4955');
  assert.equal(maskPhone('+639171234567'), '09•• ••• 4567');
});

test('maskPhone handles missing or too-short input', () => {
  assert.equal(maskPhone(null), '—');
  assert.equal(maskPhone(''), '—');
  assert.equal(maskPhone('123'), '•••');
});
