const test = require('node:test');
const assert = require('node:assert/strict');

test('startTrip populates current from a pending request', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');

  useTripStore.setState({ current: null });
  useTripStore.getState().startTrip({
    id: 'req-9',
    seats: 2,
    paymentMethod: 'cash',
    pickupLabel: null,
    dropoffLabel: null,
    fare: 45,
    createdAt: 'now',
  });

  const current = useTripStore.getState().current;
  assert.equal(current.id, 'req-9');
  assert.equal(current.fare, 45);
  assert.equal(current.cashConfirmed, false);
});

test('confirmCash flips cashConfirmed without touching other fields', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');

  useTripStore.setState({
    current: {
      id: 'req-9', passengerName: null, seats: 2, paymentMethod: 'cash', fare: 45, cashConfirmed: false, startedAt: 'now',
    },
  });

  useTripStore.getState().confirmCash();

  assert.equal(useTripStore.getState().current.cashConfirmed, true);
  assert.equal(useTripStore.getState().current.fare, 45);
});

test('complete clears current and returns the trip that was active', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');

  useTripStore.setState({
    current: { id: 'req-9', passengerName: null, seats: 2, paymentMethod: 'cash', fare: 45, cashConfirmed: true, startedAt: 'now' },
  });

  const completed = useTripStore.getState().complete();

  assert.equal(completed.id, 'req-9');
  assert.equal(useTripStore.getState().current, null);
});

test('complete on an empty trip returns null', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');

  useTripStore.setState({ current: null });

  assert.equal(useTripStore.getState().complete(), null);
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
