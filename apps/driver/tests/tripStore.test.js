const test = require('node:test');
const assert = require('node:assert/strict');

function fakeClientWithSuccess() {
  return {
    channel: () => { throw new Error('channel not needed for this test'); },
    removeChannel: () => {},
    rpc: async () => ({ data: [{ ride_request_id: 'req-9' }], error: null }),
  };
}

function passenger(id, overrides = {}) {
  return {
    id,
    passengerId: null,
    passengerName: null,
    passengerAvatarUrl: null,
    seats: 2,
    paymentMethod: 'cash',
    fare: 45,
    cashConfirmed: false,
    status: 'assigned',
    ...overrides,
  };
}

test('startTrip populates current with one passenger from a pending request and a trip id', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');

  useTripStore.setState({ current: null, error: null });
  useTripStore.getState().startTrip(
    { id: 'req-9', seats: 2, paymentMethod: 'cash', pickupLabel: null, dropoffLabel: null, fare: 45, createdAt: 'now' },
    'trip-9',
  );

  const current = useTripStore.getState().current;
  assert.equal(current.tripId, 'trip-9');
  assert.equal(current.passengers.length, 1);
  assert.deepEqual(current.passengers[0], passenger('req-9'));
});

test('addPassenger appends a second leg onto the existing trip session (FR-2.5c mid-trip pickup)', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');

  useTripStore.setState({
    current: { tripId: 'trip-9', startedAt: 'now', passengers: [passenger('req-9')] },
    error: null,
  });

  useTripStore.getState().addPassenger({ id: 'req-10', seats: 1, paymentMethod: 'gcash', fare: 20, createdAt: 'now' });

  const current = useTripStore.getState().current;
  assert.equal(current.passengers.length, 2);
  assert.equal(current.passengers[0].id, 'req-9');
  assert.deepEqual(current.passengers[1], passenger('req-10', { seats: 1, paymentMethod: 'gcash', fare: 20 }));
});

test('addPassenger is a no-op when there is no active trip', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');

  useTripStore.setState({ current: null, error: null });
  useTripStore.getState().addPassenger({ id: 'req-10', seats: 1, paymentMethod: 'gcash', fare: 20, createdAt: 'now' });

  assert.equal(useTripStore.getState().current, null);
});

test('setPassengerInfo fills in the matching passenger by rideRequestId, without touching any other passenger', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');

  useTripStore.setState({
    current: { tripId: 'trip-9', startedAt: 'now', passengers: [passenger('req-9'), passenger('req-10')] },
    error: null,
  });

  useTripStore.getState().setPassengerInfo('req-10', 'p1', 'Juan Dela Cruz', 'https://example.com/a.jpg');

  const [first, second] = useTripStore.getState().current.passengers;
  assert.deepEqual(first, passenger('req-9'));
  assert.equal(second.passengerId, 'p1');
  assert.equal(second.passengerName, 'Juan Dela Cruz');
  assert.equal(second.passengerAvatarUrl, 'https://example.com/a.jpg');
});

test('setPassengerInfo is a no-op when there is no active trip', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');

  useTripStore.setState({ current: null, error: null });
  useTripStore.getState().setPassengerInfo('req-9', 'p1', 'Juan Dela Cruz', null);

  assert.equal(useTripStore.getState().current, null);
});

test('confirmCash() marks the transaction paid in the backend and flips cashConfirmed for that passenger only', async () => {
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
    current: { tripId: 'trip-9', startedAt: 'now', passengers: [passenger('req-9'), passenger('req-10')] },
    error: null,
  });

  const ok = await useTripStore.getState().confirmCash('req-9', 'driver1');

  assert.equal(ok, true);
  const [first, second] = useTripStore.getState().current.passengers;
  assert.equal(first.cashConfirmed, true);
  assert.equal(second.cashConfirmed, false);
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
    current: { tripId: 'trip-9', startedAt: 'now', passengers: [passenger('req-9')] },
    error: null,
  });

  const ok = await useTripStore.getState().confirmCash('req-9', 'driver1');

  assert.equal(ok, false);
  assert.equal(useTripStore.getState().current.passengers[0].cashConfirmed, false);
  assert.equal(useTripStore.getState().error, 'No cash payment found for this ride yet. Please try again in a moment.');
});

test('confirmCash() is a no-op when already confirmed', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');

  useTripStore.setState({
    current: { tripId: 'trip-9', startedAt: 'now', passengers: [passenger('req-9', { cashConfirmed: true })] },
    error: null,
  });

  const ok = await useTripStore.getState().confirmCash('req-9', 'driver1');
  assert.equal(ok, false);
});

test('confirmCash() is a no-op when the ride request is not a passenger on the current trip', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');

  useTripStore.setState({
    current: { tripId: 'trip-9', startedAt: 'now', passengers: [passenger('req-9')] },
    error: null,
  });

  const ok = await useTripStore.getState().confirmCash('req-unknown', 'driver1');
  assert.equal(ok, false);
});

test('completePassenger() closes just that leg, leaving any other passenger on the trip untouched', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests(fakeClientWithSuccess());

  useTripStore.setState({
    current: { tripId: 'trip-9', startedAt: 'now', passengers: [passenger('req-9', { cashConfirmed: true }), passenger('req-10', { cashConfirmed: true })] },
    error: null,
  });

  const closed = await useTripStore.getState().completePassenger('req-9');

  assert.equal(closed.id, 'req-9');
  const current = useTripStore.getState().current;
  assert.ok(current, 'the trip itself must stay active');
  assert.equal(current.passengers.length, 1);
  assert.equal(current.passengers[0].id, 'req-10');
  assert.equal(useTripStore.getState().error, null);
});

test('completePassenger() on an unknown ride request returns null without calling the backend', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({ rpc: async () => { throw new Error('must not call the backend for an unknown passenger'); } });

  useTripStore.setState({
    current: { tripId: 'trip-9', startedAt: 'now', passengers: [passenger('req-9')] },
    error: null,
  });

  assert.equal(await useTripStore.getState().completePassenger('req-unknown'), null);
});

test('completePassenger() sets error and keeps the passenger when the backend call fails', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    channel: () => { throw new Error('channel not needed for this test'); },
    removeChannel: () => {},
    rpc: async () => ({ data: null, error: { message: 'No active trip found for this driver to complete' } }),
  });

  useTripStore.setState({
    current: { tripId: 'trip-9', startedAt: 'now', passengers: [passenger('req-9', { cashConfirmed: true })] },
    error: null,
  });

  const closed = await useTripStore.getState().completePassenger('req-9');

  assert.equal(closed, null);
  assert.equal(useTripStore.getState().current.passengers.length, 1);
  assert.equal(useTripStore.getState().error, "Couldn't close out this passenger's ride. Please try again.");
});

test('cancelPassenger() cancels just that leg, leaving any other passenger on the trip untouched', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests(fakeClientWithSuccess());

  useTripStore.setState({
    current: { tripId: 'trip-9', startedAt: 'now', passengers: [passenger('req-9'), passenger('req-10')] },
    error: null,
  });

  const cancelled = await useTripStore.getState().cancelPassenger('req-10', 'Passenger no-show');

  assert.equal(cancelled.id, 'req-10');
  const current = useTripStore.getState().current;
  assert.ok(current, 'the trip itself must stay active');
  assert.equal(current.passengers.length, 1);
  assert.equal(current.passengers[0].id, 'req-9');
});

test('cancelPassenger() on an unknown ride request returns null without calling the backend', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({ rpc: async () => { throw new Error('must not call the backend for an unknown passenger'); } });

  useTripStore.setState({
    current: { tripId: 'trip-9', startedAt: 'now', passengers: [passenger('req-9')] },
    error: null,
  });

  assert.equal(await useTripStore.getState().cancelPassenger('req-unknown', 'reason'), null);
});

test('startPassenger marks the named passenger ongoing on success, leaves others untouched', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests(fakeClientWithSuccess());

  useTripStore.setState({
    current: { tripId: 'trip-9', startedAt: 'now', passengers: [passenger('rr1'), passenger('rr2')] },
    error: null,
  });

  const ok = await useTripStore.getState().startPassenger('rr1');

  assert.equal(ok, true);
  const current = useTripStore.getState().current;
  assert.equal(current.passengers.find((p) => p.id === 'rr1').status, 'ongoing');
  assert.equal(current.passengers.find((p) => p.id === 'rr2').status, 'assigned');
  assert.equal(useTripStore.getState().error, null);
});

test('startPassenger surfaces the error and leaves status unchanged on failure', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    channel: () => { throw new Error('channel not needed for this test'); },
    removeChannel: () => {},
    rpc: async () => ({ data: null, error: { message: 'boom' } }),
  });

  useTripStore.setState({
    current: { tripId: 'trip-9', startedAt: 'now', passengers: [passenger('rr1')] },
    error: null,
  });

  const ok = await useTripStore.getState().startPassenger('rr1');

  assert.equal(ok, false);
  assert.equal(useTripStore.getState().current.passengers[0].status, 'assigned');
  assert.equal(useTripStore.getState().error, "Couldn't start this passenger's ride. Please try again.");
});

test('passengerFromRequest defaults a freshly accepted passenger to status "assigned"', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');

  useTripStore.setState({ current: null, error: null });
  useTripStore.getState().startTrip(
    { id: 'req-9', seats: 2, paymentMethod: 'cash', pickupLabel: null, dropoffLabel: null, fare: 45, createdAt: 'now' },
    'trip-9',
  );

  assert.equal(useTripStore.getState().current.passengers[0].status, 'assigned');
});

test('endTrip() succeeds and clears current once the passenger list is empty', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    channel: () => { throw new Error('channel not needed for this test'); },
    removeChannel: () => {},
    rpc: async () => ({ data: [{ trip_id: 'trip-9' }], error: null }),
  });

  useTripStore.setState({
    current: { tripId: 'trip-9', startedAt: 'now', passengers: [] },
    error: null,
  });

  const ok = await useTripStore.getState().endTrip();

  assert.equal(ok, true);
  assert.equal(useTripStore.getState().current, null);
  assert.equal(useTripStore.getState().error, null);
});

test('endTrip() refuses locally, without calling the backend, while a passenger is still on the trip', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({ rpc: async () => { throw new Error('must not call end_trip while a passenger remains'); } });

  useTripStore.setState({
    current: { tripId: 'trip-9', startedAt: 'now', passengers: [passenger('req-9')] },
    error: null,
  });

  const ok = await useTripStore.getState().endTrip();

  assert.equal(ok, false);
  assert.ok(useTripStore.getState().current, 'the trip must stay active — the driver did not actually end it');
  assert.match(useTripStore.getState().error, /complete or cancel/i);
});

test('endTrip() is a no-op returning false when there is no active trip', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');

  useTripStore.setState({ current: null, error: null });

  assert.equal(await useTripStore.getState().endTrip(), false);
});

test('endTrip() sets error and keeps current when the backend call fails', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    channel: () => { throw new Error('channel not needed for this test'); },
    removeChannel: () => {},
    rpc: async () => ({ data: null, error: { message: 'No active trip found for this driver to end' } }),
  });

  useTripStore.setState({
    current: { tripId: 'trip-9', startedAt: 'now', passengers: [] },
    error: null,
  });

  const ok = await useTripStore.getState().endTrip();

  assert.equal(ok, false);
  assert.ok(useTripStore.getState().current);
  assert.equal(useTripStore.getState().error, 'No active trip found for this driver to end');
});

test('hydrate() populates current with every passenger leg the backend returns', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    channel: () => { throw new Error('channel not needed for this test'); },
    removeChannel: () => {},
    rpc: async (fn) => {
      if (fn === 'get_active_trip_for_driver') {
        return { data: [{ trip_id: 'trip-9', started_at: '2026-08-11T00:00:00.000Z' }], error: null };
      }
      if (fn === 'get_active_trip_passengers') {
        return {
          data: [
            { ride_request_id: 'req-9', seats_requested: 2, preferred_method: 'cash', estimated_fare: 45, passenger_id: 'p1', passenger_name: 'Juan Dela Cruz', avatar_url: 'https://example.com/a.jpg', cash_confirmed: false, status: 'assigned' },
          ],
          error: null,
        };
      }
      throw new Error(`unexpected rpc ${fn}`);
    },
  });

  useTripStore.setState({ current: null, error: null });
  await useTripStore.getState().hydrate();

  assert.deepEqual(useTripStore.getState().current, {
    tripId: 'trip-9',
    startedAt: '2026-08-11T00:00:00.000Z',
    passengers: [passenger('req-9', { passengerId: 'p1', passengerName: 'Juan Dela Cruz', passengerAvatarUrl: 'https://example.com/a.jpg' })],
  });
});

test('hydrate() populates an active trip with an empty passengers array — the "stay parked between pickups" case', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    channel: () => { throw new Error('channel not needed for this test'); },
    removeChannel: () => {},
    rpc: async (fn) => {
      if (fn === 'get_active_trip_for_driver') return { data: [{ trip_id: 'trip-9', started_at: '2026-08-11T00:00:00.000Z' }], error: null };
      if (fn === 'get_active_trip_passengers') return { data: [], error: null };
      throw new Error(`unexpected rpc ${fn}`);
    },
  });

  useTripStore.setState({ current: null, error: null });
  await useTripStore.getState().hydrate();

  assert.deepEqual(useTripStore.getState().current, { tripId: 'trip-9', startedAt: '2026-08-11T00:00:00.000Z', passengers: [] });
});

test('hydrate() leaves current untouched when there is no active trip', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    channel: () => { throw new Error('channel not needed for this test'); },
    removeChannel: () => {},
    rpc: async (fn) => {
      if (fn === 'get_active_trip_for_driver') return { data: [], error: null };
      throw new Error('must not fetch passengers when there is no active trip');
    },
  });

  useTripStore.setState({ current: null, error: null });
  await useTripStore.getState().hydrate();

  assert.equal(useTripStore.getState().current, null);
});

test('hydrate() leaves current untouched on a backend error', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    channel: () => { throw new Error('channel not needed for this test'); },
    removeChannel: () => {},
    rpc: async () => ({ data: null, error: { message: 'network error' } }),
  });

  useTripStore.setState({ current: null, error: null });
  await useTripStore.getState().hydrate();

  assert.equal(useTripStore.getState().current, null);
  assert.equal(useTripStore.getState().error, null);
});

test('reset() clears current and error', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');

  useTripStore.setState({
    current: { tripId: 'trip-9', startedAt: 'now', passengers: [passenger('req-9')] },
    error: 'stale error',
  });

  useTripStore.getState().reset();

  assert.equal(useTripStore.getState().current, null);
  assert.equal(useTripStore.getState().error, null);
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

test('useHistoryStore.reset() clears trips, loading, and error back to initial state', async () => {
  const { useHistoryStore } = await import('../src/store/useHistoryStore.ts');

  useHistoryStore.setState({
    trips: [{ id: 'rr1', passengerName: 'Juan', date: 'd', fare: 45, status: 'done' }],
    loading: true,
    error: 'stale error',
  });

  useHistoryStore.getState().reset();

  assert.deepEqual(useHistoryStore.getState().trips, []);
  assert.equal(useHistoryStore.getState().loading, false);
  assert.equal(useHistoryStore.getState().error, null);
});
