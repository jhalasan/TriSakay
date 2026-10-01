// Run with: node --test supabase/functions/admin-reset-mfa/aal.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { assuranceLevel } from './aal.ts';

const bearer = (claims: unknown) => {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `Bearer header.${payload}.signature`;
};

test('assuranceLevel reads aal2 and aal1 from the bearer token', () => {
  assert.equal(assuranceLevel(bearer({ aal: 'aal2' })), 'aal2');
  assert.equal(assuranceLevel(bearer({ aal: 'aal1' })), 'aal1');
});

test('assuranceLevel is null when the claim is missing or the token is malformed', () => {
  assert.equal(assuranceLevel(bearer({ sub: 'x' })), null);
  assert.equal(assuranceLevel('Bearer not-a-jwt'), null);
  assert.equal(assuranceLevel(''), null);
});

test('assuranceLevel handles the url-safe base64 alphabet and missing padding', () => {
  // {"aal":"aal2","n":"???>>>"} encodes with - and _ in url-safe base64
  assert.equal(assuranceLevel(bearer({ aal: 'aal2', n: '???>>>' })), 'aal2');
});
