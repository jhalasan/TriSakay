const test = require('node:test');
const assert = require('node:assert/strict');

test('driver tutorial seen key is different for each account', async () => {
  const { driverTutorialSeenKey } = await import('../src/constants/tutorial.ts');

  assert.notEqual(driverTutorialSeenKey('user-a'), driverTutorialSeenKey('user-b'));
  assert.equal(driverTutorialSeenKey('user-a'), driverTutorialSeenKey('user-a'));
});

test('driver tutorial seen key ends with the user id and is not the old shared key', async () => {
  const { driverTutorialSeenKey } = await import('../src/constants/tutorial.ts');

  const key = driverTutorialSeenKey('user-a');
  assert.ok(key.endsWith('user-a'));
  assert.notEqual(key, 'trisakay_driver_tutorial_seen_at');
});
