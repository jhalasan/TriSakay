// Run with: npx tsx --test supabase/functions/create-gcash-checkout/paid.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { fareForRide, isSessionPaid } from './paid.ts';

const session = (payments: unknown) => ({ data: { attributes: { payments } } });

test('isSessionPaid: a paid payment with the expected amount is paid', () => {
  assert.equal(isSessionPaid(session([{ attributes: { status: 'paid', amount: 5500 } }]), 5500), 'paid');
});

test('isSessionPaid: a paid payment for a different amount is a mismatch, never paid', () => {
  assert.equal(isSessionPaid(session([{ attributes: { status: 'paid', amount: 100 } }]), 5500), 'mismatch');
});

test('isSessionPaid: a paid payment with no amount fails closed as a mismatch', () => {
  assert.equal(isSessionPaid(session([{ attributes: { status: 'paid' } }]), 5500), 'mismatch');
});

test('isSessionPaid: no payments, unpaid payments, or a malformed session stay pending', () => {
  assert.equal(isSessionPaid(session([]), 5500), 'pending');
  assert.equal(isSessionPaid(session([{ attributes: { status: 'failed', amount: 5500 } }]), 5500), 'pending');
  assert.equal(isSessionPaid(session(undefined), 5500), 'pending');
  assert.equal(isSessionPaid(null, 5500), 'pending');
  assert.equal(isSessionPaid('nonsense', 5500), 'pending');
});

test('isSessionPaid: one matching paid payment among several is enough', () => {
  const payments = [
    { attributes: { status: 'failed', amount: 5500 } },
    { attributes: { status: 'paid', amount: 5500 } },
  ];
  assert.equal(isSessionPaid(session(payments), 5500), 'paid');
});

test('fareForRide: a completed ride charges the locked final fare', () => {
  assert.equal(fareForRide({ status: 'completed', final_fare: 55, estimated_fare: 50, payment_requested_at: null }), 55);
  assert.equal(fareForRide({ status: 'completed', final_fare: null, estimated_fare: 50, payment_requested_at: null }), null);
});

test('fareForRide: an ongoing ride charges the estimated fare only once payment was requested', () => {
  assert.equal(fareForRide({ status: 'ongoing', final_fare: null, estimated_fare: 50, payment_requested_at: '2026-09-30T10:00:00Z' }), 50);
  assert.equal(fareForRide({ status: 'ongoing', final_fare: null, estimated_fare: 50, payment_requested_at: null }), null);
});

test('fareForRide: any other status cannot be paid', () => {
  assert.equal(fareForRide({ status: 'assigned', final_fare: null, estimated_fare: 50, payment_requested_at: '2026-09-30T10:00:00Z' }), null);
  assert.equal(fareForRide({ status: 'cancelled', final_fare: 50, estimated_fare: 50, payment_requested_at: null }), null);
});
