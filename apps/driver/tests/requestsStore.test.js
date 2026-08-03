const test = require('node:test');
const assert = require('node:assert/strict');

test('accept removes the request from pending and returns it', async () => {
  const { useRequestsStore } = await import('../src/store/useRequestsStore.ts');

  useRequestsStore.setState({
    pending: [
      { id: 'r1', seats: 2, paymentMethod: 'cash', pickupLabel: null, dropoffLabel: null, fare: null, createdAt: 'now' },
    ],
  });

  const accepted = useRequestsStore.getState().accept('r1');

  assert.equal(accepted.id, 'r1');
  assert.equal(useRequestsStore.getState().pending.length, 0);
});

test('accept returns undefined for an unknown id and leaves pending untouched', async () => {
  const { useRequestsStore } = await import('../src/store/useRequestsStore.ts');

  useRequestsStore.setState({
    pending: [
      { id: 'r2', seats: 1, paymentMethod: 'gcash', pickupLabel: null, dropoffLabel: null, fare: null, createdAt: 'now' },
    ],
  });

  const accepted = useRequestsStore.getState().accept('does-not-exist');

  assert.equal(accepted, undefined);
  assert.equal(useRequestsStore.getState().pending.length, 1);
});

test('decline removes the request without returning it', async () => {
  const { useRequestsStore } = await import('../src/store/useRequestsStore.ts');

  useRequestsStore.setState({
    pending: [
      { id: 'r3', seats: 1, paymentMethod: 'cash', pickupLabel: null, dropoffLabel: null, fare: null, createdAt: 'now' },
    ],
  });

  useRequestsStore.getState().decline('r3');

  assert.equal(useRequestsStore.getState().pending.length, 0);
});

test('stopSimulatingArrivals synchronously clears pending', async () => {
  const { useRequestsStore } = await import('../src/store/useRequestsStore.ts');

  useRequestsStore.setState({
    pending: [
      { id: 'r4', seats: 1, paymentMethod: 'cash', pickupLabel: null, dropoffLabel: null, fare: null, createdAt: 'now' },
    ],
  });

  useRequestsStore.getState().stopSimulatingArrivals();

  assert.equal(useRequestsStore.getState().pending.length, 0);
});

test('the simulation epoch guard prevents a request from being appended after stopping', async () => {
  // startSimulatingArrivals loops on `await wait(randomBetween(8000, 15000))` before appending
  // a placeholder request. Waiting out a real 8-15s delay in a unit test is impractical, so this
  // test fast-forwards the wait by temporarily making the global setTimeout fire immediately,
  // while keeping the real delay/epoch logic under test untouched.
  const { useRequestsStore } = await import('../src/store/useRequestsStore.ts');

  useRequestsStore.setState({ pending: [] });

  const originalSetTimeout = global.setTimeout;
  global.setTimeout = (fn, _ms, ...args) => originalSetTimeout(fn, 0, ...args);

  try {
    useRequestsStore.getState().startSimulatingArrivals();
    // Stop before the fast-forwarded wait() resolves — the loop's epoch check should see the
    // epoch has moved on and bail out without appending.
    useRequestsStore.getState().stopSimulatingArrivals();

    // Give the fast-forwarded timer a chance to fire and the loop's `.then` to run.
    await new Promise((resolve) => originalSetTimeout(resolve, 20));
  } finally {
    global.setTimeout = originalSetTimeout;
  }

  assert.equal(useRequestsStore.getState().pending.length, 0);
});
