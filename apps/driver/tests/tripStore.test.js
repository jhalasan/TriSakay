const test = require('node:test');
const assert = require('node:assert/strict');

function fakeClientWithSuccess() {
  return {
    channel: () => { throw new Error('channel not needed for this test'); },
    removeChannel: () => {},
    from: () => ({
      // completeTrip() reads estimated_fare before writing final_fare.
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { estimated_fare: 45 }, error: null }) }) }),
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
  assert.equal(current.passengerName, null);
  assert.equal(current.passengerAvatarUrl, null);
});

test('setPassengerInfo fills in the passenger name/photo without touching other fields', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');

  useTripStore.setState({
    current: { id: 'req-9', tripId: 'trip-9', passengerName: null, passengerAvatarUrl: null, seats: 2, paymentMethod: 'cash', fare: 45, cashConfirmed: false, startedAt: 'now' },
    error: null,
  });

  useTripStore.getState().setPassengerInfo('Juan Dela Cruz', 'https://example.com/a.jpg');

  const current = useTripStore.getState().current;
  assert.equal(current.passengerName, 'Juan Dela Cruz');
  assert.equal(current.passengerAvatarUrl, 'https://example.com/a.jpg');
  assert.equal(current.fare, 45);
});

test('setPassengerInfo is a no-op when there is no active trip', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');

  useTripStore.setState({ current: null, error: null });
  useTripStore.getState().setPassengerInfo('Juan Dela Cruz', null);

  assert.equal(useTripStore.getState().current, null);
});

test('confirmCash() marks the transaction paid in the backend and flips cashConfirmed', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  let capturedUpdate = null;
  let capturedFilters = [];
  __setSupabaseClientForTests({
    channel: () => { throw new Error('channel not needed for this test'); },
    removeChannel: () => {},
    from: () => ({
      update: (row) => {
        capturedUpdate = row;
        return {
          eq: (column, value) => {
            capturedFilters.push({ column, value });
            return {
              eq: (column2, value2) => {
                capturedFilters.push({ column: column2, value: value2 });
                return { select: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'txn1' }, error: null }) }) };
              },
            };
          },
        };
      },
    }),
  });

  useTripStore.setState({
    current: { id: 'req-9', tripId: 'trip-9', passengerName: null, passengerAvatarUrl: null, seats: 2, paymentMethod: 'cash', fare: 45, cashConfirmed: false, startedAt: 'now' },
    error: null,
  });

  const ok = await useTripStore.getState().confirmCash('driver1');

  assert.equal(ok, true);
  assert.equal(useTripStore.getState().current.cashConfirmed, true);
  assert.equal(useTripStore.getState().current.fare, 45);
  assert.equal(useTripStore.getState().error, null);
  assert.equal(capturedUpdate.status, 'paid');
  assert.equal(capturedUpdate.cash_confirmed_by, 'driver1');
  assert.deepEqual(capturedFilters, [
    { column: 'ride_request_id', value: 'req-9' },
    { column: 'method', value: 'cash' },
  ]);
});

test("confirmCash() sets error and leaves cashConfirmed false when no pending cash transaction is found", async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    channel: () => { throw new Error('channel not needed for this test'); },
    removeChannel: () => {},
    from: () => ({
      update: () => ({ eq: () => ({ eq: () => ({ select: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) }),
    }),
  });

  useTripStore.setState({
    current: { id: 'req-9', tripId: 'trip-9', passengerName: null, passengerAvatarUrl: null, seats: 2, paymentMethod: 'cash', fare: 45, cashConfirmed: false, startedAt: 'now' },
    error: null,
  });

  const ok = await useTripStore.getState().confirmCash('driver1');

  assert.equal(ok, false);
  assert.equal(useTripStore.getState().current.cashConfirmed, false);
  assert.equal(useTripStore.getState().error, 'No cash payment found for this ride yet. Please try again in a moment.');
});

test('confirmCash() is a no-op when already confirmed', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');

  useTripStore.setState({
    current: { id: 'req-9', tripId: 'trip-9', passengerName: null, passengerAvatarUrl: null, seats: 2, paymentMethod: 'cash', fare: 45, cashConfirmed: true, startedAt: 'now' },
    error: null,
  });

  const ok = await useTripStore.getState().confirmCash('driver1');
  assert.equal(ok, false);
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
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { estimated_fare: 45 }, error: null }) }) }),
      update: () => ({ eq: () => Promise.resolve({ error: { message: 'network error' } }) }),
    }),
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

test('useEarningsStore.load() sums total_collected from v_driver_earnings', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'driver1' } } } }) },
    from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [{ total_collected: 45 }, { total_collected: 30 }], error: null }) }) }),
  });

  useEarningsStore.setState({ totalTracked: 0, loading: false, error: null, settlementLog: [] });
  await useEarningsStore.getState().load();

  assert.equal(useEarningsStore.getState().totalTracked, 75);
  assert.equal(useEarningsStore.getState().loading, false);
  assert.equal(useEarningsStore.getState().error, null);
});

test('useEarningsStore.load() surfaces an error without touching totalTracked', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'driver1' } } } }) },
    from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'network error' } }) }) }),
  });

  useEarningsStore.setState({ totalTracked: 99, loading: false, error: null, settlementLog: [] });
  await useEarningsStore.getState().load();

  assert.equal(useEarningsStore.getState().totalTracked, 99);
  assert.equal(useEarningsStore.getState().error, 'network error');
});

test('useEarningsStore.notifyPsoForSettlement logs the current total', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');

  useEarningsStore.setState({ totalTracked: 120, settlementLog: [] });
  useEarningsStore.getState().notifyPsoForSettlement();

  const log = useEarningsStore.getState().settlementLog;
  assert.equal(log.length, 1);
  assert.equal(log[0].amount, 120);
});

test('useHistoryStore.load() fetches and maps completed/cancelled trips from the RPC', async () => {
  const { useHistoryStore } = await import('../src/store/useHistoryStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    channel: () => { throw new Error('channel not needed for this test'); },
    removeChannel: () => {},
    rpc: async () => ({
      data: [
        { ride_request_id: 'rr1', passenger_name: 'Juan Dela Cruz', status: 'completed', fare: 45, completed_at: '2026-08-10T00:00:00.000Z', cancelled_at: null, requested_at: '2026-08-09T23:00:00.000Z' },
        { ride_request_id: 'rr2', passenger_name: null, status: 'cancelled', fare: null, completed_at: null, cancelled_at: '2026-08-08T00:00:00.000Z', requested_at: '2026-08-07T23:00:00.000Z' },
      ],
      error: null,
    }),
  });

  useHistoryStore.setState({ trips: [], loading: false, error: null });
  await useHistoryStore.getState().load();

  const trips = useHistoryStore.getState().trips;
  assert.equal(useHistoryStore.getState().loading, false);
  assert.equal(useHistoryStore.getState().error, null);
  assert.equal(trips.length, 2);
  assert.deepEqual(trips[0], { id: 'rr1', passengerName: 'Juan Dela Cruz', date: '2026-08-10T00:00:00.000Z', fare: 45, status: 'done' });
  assert.deepEqual(trips[1], { id: 'rr2', passengerName: null, date: '2026-08-08T00:00:00.000Z', fare: null, status: 'cancelled' });
});

test('useHistoryStore.load() surfaces an RPC error without touching trips', async () => {
  const { useHistoryStore } = await import('../src/store/useHistoryStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    channel: () => { throw new Error('channel not needed for this test'); },
    removeChannel: () => {},
    rpc: async () => ({ data: null, error: { message: 'network error' } }),
  });

  useHistoryStore.setState({ trips: [{ id: 'stale', passengerName: null, date: 'd', fare: null, status: 'done' }], loading: false, error: null });
  await useHistoryStore.getState().load();

  assert.equal(useHistoryStore.getState().error, 'network error');
  assert.equal(useHistoryStore.getState().trips.length, 1);
  assert.equal(useHistoryStore.getState().trips[0].id, 'stale');
});
