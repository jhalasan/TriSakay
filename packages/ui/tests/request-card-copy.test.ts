import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPickupLabel, formatPaymentSeatsLabel } from '../src/components/RequestCard/RequestCard.ts';

test('formatPickupLabel appends distance when known', () => {
  assert.equal(formatPickupLabel(400), 'Pickup · 400 m away');
});

test('formatPickupLabel falls back to plain "Pickup" when distance is unknown', () => {
  assert.equal(formatPickupLabel(null), 'Pickup');
});

test('formatPaymentSeatsLabel uppercases payment method and pluralizes seats', () => {
  assert.equal(formatPaymentSeatsLabel('cash', 2), 'CASH · 2 SEATS');
  assert.equal(formatPaymentSeatsLabel('gcash', 1), 'GCASH · 1 SEAT');
});
