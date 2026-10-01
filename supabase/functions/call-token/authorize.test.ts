// Run with: node --test supabase/functions/call-token/authorize.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeCallToken, randomUid } from './authorize.ts';

const call = { status: 'answered', caller_id: 'p1', callee_id: 'd1' };
const ride = { status: 'ongoing', passenger_id: 'p1', driver_id: 'd1' };

test('either party may get a token for an answered call on an active ride', () => {
  assert.deepEqual(authorizeCallToken('p1', call, ride), { ok: true });
  assert.deepEqual(authorizeCallToken('d1', call, ride), { ok: true });
});

test('the caller may join while it rings, but the callee must answer first', () => {
  const ringing = { ...call, status: 'ringing' };
  assert.deepEqual(authorizeCallToken('p1', ringing, ride), { ok: true });
  assert.deepEqual(authorizeCallToken('d1', ringing, ride), { ok: false, status: 409, error: 'Answer the call first' });
});

test('a stranger, a missing call, and a finished call are refused', () => {
  assert.deepEqual(authorizeCallToken('x', call, ride), { ok: false, status: 403, error: 'This call is not yours' });
  assert.deepEqual(authorizeCallToken('p1', null, ride), { ok: false, status: 404, error: 'Call not found' });
  for (const status of ['declined', 'cancelled', 'missed', 'ended']) {
    assert.deepEqual(authorizeCallToken('p1', { ...call, status }, ride), { ok: false, status: 409, error: 'This call has ended' });
  }
});

test('an inactive ride, or a ride whose driver changed, is refused', () => {
  for (const status of ['pending', 'completed', 'cancelled']) {
    assert.deepEqual(authorizeCallToken('p1', call, { ...ride, status }), { ok: false, status: 409, error: 'This ride is no longer active' });
  }
  assert.deepEqual(authorizeCallToken('p1', call, null), { ok: false, status: 409, error: 'This ride is no longer active' });
  assert.deepEqual(authorizeCallToken('p1', call, { ...ride, driver_id: 'other' }), {
    ok: false,
    status: 409,
    error: 'This call no longer matches the ride',
  });
  assert.deepEqual(authorizeCallToken('p1', call, { ...ride, driver_id: null }), {
    ok: false,
    status: 409,
    error: 'This call no longer matches the ride',
  });
});

test('randomUid is a positive 31-bit integer', () => {
  for (let i = 0; i < 200; i++) {
    const uid = randomUid();
    assert.ok(Number.isInteger(uid) && uid >= 1 && uid <= 2147483646);
  }
});
