const test = require('node:test');
const assert = require('node:assert/strict');

const SESSION = { data: { session: { user: { id: 'driver1' } } } };

function driverEarningsView(rows) {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => Promise.resolve({ data: rows, error: null }),
  };
  return query;
}

test('load() populates totalTracked and dailyBreakdown from the real service call', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    auth: { getSession: async () => SESSION },
    from: (table) =>
      table === 'v_driver_earnings'
        ? driverEarningsView([
            { earning_date: '2026-08-19', rides_completed: 2, total_collected: 45 },
            { earning_date: '2026-08-20', rides_completed: 1, total_collected: 30 },
          ])
        : {},
  });

  useEarningsStore.setState({ totalTracked: 0, dailyBreakdown: [], error: null });
  await useEarningsStore.getState().load();

  assert.equal(useEarningsStore.getState().totalTracked, 75);
  assert.deepEqual(useEarningsStore.getState().dailyBreakdown, [
    { date: '2026-08-19', ridesCompleted: 2, totalCollected: 45 },
    { date: '2026-08-20', ridesCompleted: 1, totalCollected: 30 },
  ]);
  assert.equal(useEarningsStore.getState().error, null);
});

test('load() reports 0 total and an empty breakdown when there are no rows yet', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    auth: { getSession: async () => SESSION },
    from: (table) => (table === 'v_driver_earnings' ? driverEarningsView([]) : {}),
  });

  useEarningsStore.setState({ totalTracked: 999, dailyBreakdown: [{ date: 'x', ridesCompleted: 1, totalCollected: 1 }], error: null });
  await useEarningsStore.getState().load();

  assert.equal(useEarningsStore.getState().totalTracked, 0);
  assert.deepEqual(useEarningsStore.getState().dailyBreakdown, []);
});

test('load() surfaces a query error and leaves prior state alone', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    auth: { getSession: async () => SESSION },
    from: (table) =>
      table === 'v_driver_earnings'
        ? { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: null, error: { message: 'network down' } }) }) }) }
        : {},
  });

  const priorBreakdown = [{ date: '2026-08-18', ridesCompleted: 1, totalCollected: 10 }];
  useEarningsStore.setState({ totalTracked: 10, dailyBreakdown: priorBreakdown, error: null });
  await useEarningsStore.getState().load();

  assert.equal(useEarningsStore.getState().error, 'network down');
  assert.equal(useEarningsStore.getState().totalTracked, 10);
  assert.deepEqual(useEarningsStore.getState().dailyBreakdown, priorBreakdown);
});

test('notifyPsoForSettlement() logs the current totalTracked as a new entry', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');

  useEarningsStore.setState({ totalTracked: 120, settlementLog: [] });
  useEarningsStore.getState().notifyPsoForSettlement();

  const log = useEarningsStore.getState().settlementLog;
  assert.equal(log.length, 1);
  assert.equal(log[0].amount, 120);
  assert.ok(log[0].loggedAt);
});

test('reset() clears every field back to initial state', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');

  useEarningsStore.setState({
    totalTracked: 500,
    dailyBreakdown: [{ date: '2026-08-20', ridesCompleted: 2, totalCollected: 90 }],
    loading: true,
    error: 'stale error',
    settlementLog: [{ id: 'settle-1', amount: 500, loggedAt: 'now' }],
  });

  useEarningsStore.getState().reset();

  assert.equal(useEarningsStore.getState().totalTracked, 0);
  assert.deepEqual(useEarningsStore.getState().dailyBreakdown, []);
  assert.equal(useEarningsStore.getState().loading, false);
  assert.equal(useEarningsStore.getState().error, null);
  assert.deepEqual(useEarningsStore.getState().settlementLog, []);
});
