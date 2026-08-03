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
