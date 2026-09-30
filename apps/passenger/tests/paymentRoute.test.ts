import test from 'node:test';
import assert from 'node:assert/strict';
import { routeAfterPayment, shouldOpenPaymentScreen } from '../src/utils/paymentRoute.ts';

test('shouldOpenPaymentScreen: opens only for an ongoing GCash ride the driver has requested payment for', () => {
  assert.equal(shouldOpenPaymentScreen({ status: 'ongoing', preferred_method: 'gcash', payment_requested_at: '2026-09-30T10:00:00Z' }), true);
});

test('shouldOpenPaymentScreen: never for a ride switched to cash, even though payment was requested earlier', () => {
  assert.equal(shouldOpenPaymentScreen({ status: 'ongoing', preferred_method: 'cash', payment_requested_at: '2026-09-30T10:00:00Z' }), false);
});

test('shouldOpenPaymentScreen: not before the driver requests, and not outside an ongoing ride', () => {
  assert.equal(shouldOpenPaymentScreen({ status: 'ongoing', preferred_method: 'gcash', payment_requested_at: null }), false);
  assert.equal(shouldOpenPaymentScreen({ status: 'ongoing', preferred_method: 'gcash' }), false);
  assert.equal(shouldOpenPaymentScreen({ status: 'assigned', preferred_method: 'gcash', payment_requested_at: 'x' }), false);
  assert.equal(shouldOpenPaymentScreen({ status: 'completed', preferred_method: 'gcash', payment_requested_at: 'x' }), false);
});

test('routeAfterPayment: back to the ride while it is still going, trip complete once it has completed', () => {
  assert.equal(routeAfterPayment('ongoing'), '/booking/trip');
  assert.equal(routeAfterPayment('assigned'), '/booking/trip');
  assert.equal(routeAfterPayment('completed'), '/booking/trip-complete');
});

test('routeAfterPayment: an unknown or missing status falls back to the ride screen, which resolves the real state', () => {
  assert.equal(routeAfterPayment(null), '/booking/trip');
  assert.equal(routeAfterPayment('cancelled'), '/booking/trip');
});
