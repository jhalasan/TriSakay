const test = require('node:test');
const assert = require('node:assert/strict');

function fakeClientWithSuccess() {
  return {
    channel: () => { throw new Error('channel not needed for this test'); },
    removeChannel: () => {},
    from: () => ({
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  };
}

test('startTrip populates current from a pending request and a trip id', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');

  useTripStore.setState({ current: null, error: null });
  useTripStore.getState().startTrip(
    { id: 'req-9', seats: 2, paymentMethod: 'cash', pickupLabel: null, dropoffLabel: null, fare: 45, createdAt: 'now' },
    'trip-9',
  );

  const current = useTripStore.getState().current;
  assert.equal(current.id, 'req-9');
  assert.equal(current.tripId, 'trip-9');
  assert.equal(current.fare, 45);
  assert.equal(current.cashConfirmed, false);
});

test('confirmCash flips cashConfirmed without touching other fields', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');

  useTripStore.setState({
    current: { id: 'req-9', tripId: 'trip-9', passengerName: null, seats: 2, paymentMethod: 'cash', fare: 45, cashConfirmed: false, startedAt: 'now' },
  });

  useTripStore.getState().confirmCash();

  assert.equal(useTripStore.getState().current.cashConfirmed, true);
  assert.equal(useTripStore.getState().current.fare, 45);
});

test('complete() closes the trip in the backend, clears current, and returns the trip that was active', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests(fakeClientWithSuccess());

  useTripStore.setState({
    current: { id: 'req-9', tripId: 'trip-9', passengerName: null, seats: 2, paymentMethod: 'cash', fare: 45, cashConfirmed: true, startedAt: 'now' },
    error: null,
  });

  const completed = await useTripStore.getState().complete();

  assert.equal(completed.id, 'req-9');
  assert.equal(useTripStore.getState().current, null);
  assert.equal(useTripStore.getState().error, null);
});

test('complete() on an empty trip returns null without calling the backend', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');

  useTripStore.setState({ current: null, error: null });

  assert.equal(await useTripStore.getState().complete(), null);
});

test('complete() sets error and keeps current when the backend call fails', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    channel: () => { throw new Error('channel not needed for this test'); },
    removeChannel: () => {},
    from: () => ({ update: () => ({ eq: () => Promise.resolve({ error: { message: 'network error' } }) }) }),
  });

  useTripStore.setState({
    current: { id: 'req-9', tripId: 'trip-9', passengerName: null, seats: 2, paymentMethod: 'cash', fare: 45, cashConfirmed: true, startedAt: 'now' },
    error: null,
  });

  const completed = await useTripStore.getState().complete();

  assert.equal(completed, null);
  assert.ok(useTripStore.getState().current);
  assert.equal(useTripStore.getState().error, "Couldn't close out the trip. Please try again.");
});

test('cancel() closes the trip in the backend, clears current, and returns the trip that was active', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests(fakeClientWithSuccess());

  useTripStore.setState({
    current: { id: 'req-9', tripId: 'trip-9', passengerName: null, seats: 2, paymentMethod: 'cash', fare: 45, cashConfirmed: true, startedAt: 'now' },
    error: null,
  });

  const cancelled = await useTripStore.getState().cancel('Cancelled by driver');

  assert.equal(cancelled.id, 'req-9');
  assert.equal(useTripStore.getState().current, null);
});

test('cancel() on an empty trip returns null without calling the backend', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');

  useTripStore.setState({ current: null, error: null });

  assert.equal(await useTripStore.getState().cancel('Cancelled by driver'), null);
});

test('useEarningsStore.creditTrip accumulates totalTracked', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');

  useEarningsStore.setState({ totalTracked: 0, settlementLog: [] });
  useEarningsStore.getState().creditTrip(45);
  useEarningsStore.getState().creditTrip(30);

  assert.equal(useEarningsStore.getState().totalTracked, 75);
});

test('useEarningsStore.notifyPsoForSettlement logs the current total', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');

  useEarningsStore.setState({ totalTracked: 120, settlementLog: [] });
  useEarningsStore.getState().notifyPsoForSettlement();

  const log = useEarningsStore.getState().settlementLog;
  assert.equal(log.length, 1);
  assert.equal(log[0].amount, 120);
});

test('useHistoryStore.addTrip prepends to trips', async () => {
  const { useHistoryStore } = await import('../src/store/useHistoryStore.ts');

  useHistoryStore.setState({ trips: [] });
  useHistoryStore.getState().addTrip({ id: 't1', passengerName: null, date: 'd1', fare: 15, status: 'done' });
  useHistoryStore.getState().addTrip({ id: 't2', passengerName: null, date: 'd2', fare: 20, status: 'done' });

  const trips = useHistoryStore.getState().trips;
  assert.equal(trips.length, 2);
  assert.equal(trips[0].id, 't2');
});
