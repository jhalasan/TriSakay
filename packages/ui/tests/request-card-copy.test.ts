import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPickupLabel, formatPaymentSeatsLabel } from '../src/components/RequestCard/RequestCard.ts';

test('formatPickupLabel appends distance when known', () => {
  assert.equal(formatPickupLabel(400), 'Pickup · 400 m away');
});

test('formatPickupLabel falls back to plain "Pickup" when distance is unknown', () => {
  assert.equal(formatPickupLabel(null), 'Pickup');
});

test('formatPaymentSeatsLabel builds a label from translated copy and pluralizes seats', () => {
  const copy = { seatsSingular: 'seat', seatsPlural: 'seats', paymentMethodCash: 'Cash', paymentMethodGcash: 'GCash' };
  assert.equal(formatPaymentSeatsLabel('cash', 2, copy), 'Cash · 2 seats');
  assert.equal(formatPaymentSeatsLabel('gcash', 1, copy), 'GCash · 1 seat');
});
