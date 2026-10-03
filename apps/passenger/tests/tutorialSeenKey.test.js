const test = require('node:test');
const assert = require('node:assert/strict');

test('passenger tutorial seen key is different for each account', async () => {
  const { passengerTutorialSeenKey } = await import('../src/constants/tutorial.ts');

  assert.notEqual(passengerTutorialSeenKey('user-a'), passengerTutorialSeenKey('user-b'));
  assert.equal(passengerTutorialSeenKey('user-a'), passengerTutorialSeenKey('user-a'));
});

test('passenger tutorial seen key ends with the user id and is not the old shared key', async () => {
  const { passengerTutorialSeenKey } = await import('../src/constants/tutorial.ts');

  const key = passengerTutorialSeenKey('user-a');
  assert.ok(key.endsWith('user-a'));
  assert.notEqual(key, 'trisakay_passenger_tutorial_seen_at');
});
