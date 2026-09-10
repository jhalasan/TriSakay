import test from 'node:test';
import assert from 'node:assert/strict';
import { PASSWORD_REQUIREMENTS, passwordPolicyError, passwordStrength } from '../src/lib/passwordPolicy.ts';

test('PASSWORD_REQUIREMENTS: each rule is met only when its own condition holds', () => {
  const byKey = Object.fromEntries(PASSWORD_REQUIREMENTS.map((r) => [r.key, r]));

  assert.equal(byKey.length.met('Ab1!aaaa'), false, '8 chars is short of the 10-char minimum');
  assert.equal(byKey.length.met('Ab1!aaaaaa'), true, '10 chars meets the minimum');

  assert.equal(byKey.case.met('alllowercase1!'), false);
  assert.equal(byKey.case.met('ALLUPPERCASE1!'), false);
  assert.equal(byKey.case.met('MixedCase1!'), true);

  assert.equal(byKey.numberOrSymbol.met('NoDigitsHere'), false);
  assert.equal(byKey.numberOrSymbol.met('HasADigit1'), true);
  assert.equal(byKey.numberOrSymbol.met('HasASymbol!'), true);
});

test('passwordPolicyError() is null only when every requirement is met', () => {
  assert.equal(passwordPolicyError('short'), 'Password must be at least 10 characters and include upper and lower case letters plus a number or symbol.');
  assert.equal(passwordPolicyError('nouppercase1!'), 'Password must be at least 10 characters and include upper and lower case letters plus a number or symbol.');
  assert.equal(passwordPolicyError('ValidPass1!'), null);
});

test('passwordStrength() buckets by how many requirements are met', () => {
  assert.equal(passwordStrength(''), 'weak');
  assert.equal(passwordStrength('alllowercase'), 'weak'); // only length met
  assert.equal(passwordStrength('MixedCaseX'), 'fair'); // length + case met, no digit/symbol
  assert.equal(passwordStrength('MixedCase1!'), 'strong'); // all three met
});
