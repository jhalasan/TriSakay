const test = require('node:test');
const assert = require('node:assert/strict');

const copy = {
  inviteReason: 'Reason: {reason}',
  invitePickupAt: 'Pick up at: {place}',
  inviteOnBoard: 'The passenger is already on board.',
  inviteMeetingPoint: 'Meeting point: {km} km from you',
  inviteDestination: 'Going to: {place}',
  inviteFare: 'Fare: {fare}',
  inviteSeats: 'Seats: {seats}',
  inviteTripKm: 'Trip: {km} km',
  inviteSecondsLeft: 'Respond within {seconds} seconds',
};
const money = (n) => `P${n.toFixed(2)}`;
const details = {
  pickupPlace: 'Plaza',
  destinationPlace: 'City Hall',
  seats: 2,
  rideKm: 3.4,
  fare: 35,
  handoffAfterPickup: false,
  handoffKm: 1.2,
};

test('a transfer before pickup tells the driver where to pick up, where it goes, the fare and the time left', async () => {
  const { buildTransferInviteMessage } = await import('../src/utils/transferInviteText.ts');

  assert.equal(
    buildTransferInviteMessage({ reason: 'Vehicle breakdown', details, secondsLeft: 24, copy, formatMoney: money }),
    [
      'Reason: Vehicle breakdown',
      'Pick up at: Plaza',
      'Meeting point: 1.2 km from you',
      'Going to: City Hall',
      'Fare: P35.00 · Seats: 2 · Trip: 3.4 km',
      'Respond within 24 seconds',
    ].join('\n'),
  );
});

test('a transfer after pickup says the passenger is on board instead of naming a pickup place', async () => {
  const { buildTransferInviteMessage } = await import('../src/utils/transferInviteText.ts');

  const text = buildTransferInviteMessage({
    reason: 'No more free seats',
    details: { ...details, handoffAfterPickup: true },
    secondsLeft: 10,
    copy,
    formatMoney: money,
  });

  assert.ok(text.includes('The passenger is already on board.'));
  assert.ok(!text.includes('Pick up at'));
  assert.ok(text.includes('Meeting point: 1.2 km from you'));
});

test('lines with no data are left out rather than printed empty', async () => {
  const { buildTransferInviteMessage } = await import('../src/utils/transferInviteText.ts');

  const text = buildTransferInviteMessage({
    reason: '',
    details: { ...details, pickupPlace: null, destinationPlace: null, rideKm: null, fare: null, handoffKm: null },
    secondsLeft: 5,
    copy,
    formatMoney: money,
  });

  assert.equal(text, ['Seats: 2', 'Respond within 5 seconds'].join('\n'));
});

test('before the details arrive the driver still sees the reason and the time left', async () => {
  const { buildTransferInviteMessage } = await import('../src/utils/transferInviteText.ts');

  assert.equal(
    buildTransferInviteMessage({ reason: 'Vehicle breakdown', details: null, secondsLeft: 30, copy, formatMoney: money }),
    ['Reason: Vehicle breakdown', 'Respond within 30 seconds'].join('\n'),
  );
});

test('the time left never shows a negative number', async () => {
  const { buildTransferInviteMessage } = await import('../src/utils/transferInviteText.ts');

  const text = buildTransferInviteMessage({ reason: '', details: null, secondsLeft: -3, copy, formatMoney: money });

  assert.equal(text, 'Respond within 0 seconds');
});
