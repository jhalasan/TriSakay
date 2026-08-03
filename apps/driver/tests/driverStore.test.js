const test = require('node:test');
const assert = require('node:assert/strict');

test('recordCompletedTrip accumulates todayEarnings and increments todayTrips', async () => {
  const { useDriverStore } = await import('../src/store/useDriverStore.ts');

  useDriverStore.setState({ todayEarnings: 0, todayTrips: 0 });

  useDriverStore.getState().recordCompletedTrip(45);
  useDriverStore.getState().recordCompletedTrip(30);

  assert.equal(useDriverStore.getState().todayEarnings, 75);
  assert.equal(useDriverStore.getState().todayTrips, 2);
});
