// Run with: node --test supabase/functions/send-receipt/receipt.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReceiptEmail, checkSendAllowed, referenceCode, type ReceiptData } from './receipt.ts';

const base: ReceiptData = {
  rideRequestId: '8f3c1d2e-aaaa-bbbb-cccc-0123456789ab',
  passengerFirstName: 'Maria',
  driverFirstName: 'Ferdinand',
  plateNo: 'ABC 123',
  pickupLabel: 'Calumpang Public Market',
  destLabel: 'KCC Mall of Gensan',
  fare: 45,
  seats: 1,
  paymentMethod: 'gcash',
  paymentStatus: 'paid',
  completedAt: '2026-10-01T02:30:00.000Z',
  distanceKm: 3.2,
  durationMinutes: 11.4,
  discountApplied: false,
  discountPercent: null,
};

test('referenceCode is the last six characters of the id, upper-case, like the app', () => {
  assert.equal(referenceCode('8f3c1d2e-aaaa-bbbb-cccc-0123456789ab'), '456789AB'.slice(-6));
  assert.equal(referenceCode('8f3c1d2e-aaaa-bbbb-cccc-0123456789ab'), '6789AB');
});

test('the receipt shows the reference, route, fare, driver first name, plate and payment', () => {
  const { subject, html, text } = buildReceiptEmail(base);
  assert.match(subject, /6789AB/);
  for (const out of [html, text]) {
    assert.match(out, /Calumpang Public Market/);
    assert.match(out, /KCC Mall of Gensan/);
    assert.match(out, /₱45\.00/);
    assert.match(out, /Ferdinand/);
    assert.match(out, /ABC 123/);
    assert.match(out, /GCash/);
    assert.match(out, /3\.2 km/);
    assert.match(out, /11 min/);
  }
});

test('the date is shown in Manila time', () => {
  // 02:30 UTC on 1 Oct is 10:30 AM in Manila.
  assert.match(buildReceiptEmail(base).text, /10:30/);
});

test('a discount adds a line with its percent, and no discount adds none', () => {
  assert.match(buildReceiptEmail({ ...base, discountApplied: true, discountPercent: 20 }).text, /20% discount/i);
  assert.doesNotMatch(buildReceiptEmail(base).text, /discount/i);
});

test('cash and unsettled payments are described plainly', () => {
  assert.match(buildReceiptEmail({ ...base, paymentMethod: 'cash', paymentStatus: 'pending' }).text, /Cash/);
  assert.match(buildReceiptEmail({ ...base, paymentMethod: 'cash', paymentStatus: 'pending' }).text, /pending/i);
  assert.match(buildReceiptEmail({ ...base, paymentMethod: 'cash', paymentStatus: 'paid' }).text, /Paid/);
});

test('missing driver, plate, distance, duration and payment do not break the email', () => {
  const sparse: ReceiptData = {
    ...base,
    driverFirstName: null,
    plateNo: null,
    distanceKm: null,
    durationMinutes: null,
    paymentMethod: null,
    paymentStatus: null,
    pickupLabel: null,
    destLabel: null,
  };
  const { html, text } = buildReceiptEmail(sparse);
  assert.match(text, /₱45\.00/);
  assert.doesNotMatch(text, /undefined|null/);
  assert.doesNotMatch(html, /undefined|null/);
});

test('place names are HTML-escaped in the HTML body', () => {
  const { html, text } = buildReceiptEmail({ ...base, pickupLabel: '<script>alert(1)</script> & Co', passengerFirstName: '<b>Maria</b>' });
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<b>Maria<\/b>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&amp; Co/);
  assert.match(text, /<script>/); // plain text is not HTML, so it is left as typed
});

test('manual sends stop at 3 per ride and 20 per day; automatic sends are not counted against the manual limits', () => {
  assert.equal(checkSendAllowed('manual', { perRide: 2, perDay: 5 }), 'ok');
  assert.equal(checkSendAllowed('manual', { perRide: 3, perDay: 5 }), 'ride_limit');
  assert.equal(checkSendAllowed('manual', { perRide: 0, perDay: 20 }), 'day_limit');
  assert.equal(checkSendAllowed('auto', { perRide: 3, perDay: 20 }), 'ok');
});
