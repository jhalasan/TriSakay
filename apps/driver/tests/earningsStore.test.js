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

function settlementsTable(rows, { insertError = null } = {}) {
  return {
    select: () => ({
      eq: () => ({
        order: () => Promise.resolve({ data: rows, error: null }),
      }),
    }),
    insert: () => Promise.resolve({ error: insertError }),
  };
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
        : table === 'settlements'
          ? settlementsTable([])
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

test('load() also populates settlementLog from the real settlements table, newest first', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    auth: { getSession: async () => SESSION },
    from: (table) =>
      table === 'v_driver_earnings'
        ? driverEarningsView([])
        : table === 'settlements'
          ? settlementsTable([{ id: 's2', amount: 90, notified_at: '2026-08-20T00:00:00Z' }])
          : {},
  });

  useEarningsStore.setState({ settlementLog: [] });
  await useEarningsStore.getState().load();

  assert.deepEqual(useEarningsStore.getState().settlementLog, [
    { id: 's2', amount: 90, loggedAt: '2026-08-20T00:00:00Z' },
  ]);
  assert.equal(useEarningsStore.getState().settlementsError, null);
});

test('load() reports 0 total and an empty breakdown when there are no rows yet', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    auth: { getSession: async () => SESSION },
    from: (table) => (table === 'v_driver_earnings' ? driverEarningsView([]) : table === 'settlements' ? settlementsTable([]) : {}),
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
        : table === 'settlements'
          ? settlementsTable([])
          : {},
  });

  const priorBreakdown = [{ date: '2026-08-18', ridesCompleted: 1, totalCollected: 10 }];
  useEarningsStore.setState({ totalTracked: 10, dailyBreakdown: priorBreakdown, error: null });
  await useEarningsStore.getState().load();

  assert.equal(useEarningsStore.getState().error, 'network down');
  assert.equal(useEarningsStore.getState().totalTracked, 10);
  assert.deepEqual(useEarningsStore.getState().dailyBreakdown, priorBreakdown);
});

test('notifyPsoForSettlement() inserts the current totalTracked and reloads the log from the real table', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  let insertedRow = null;
  __setSupabaseClientForTests({
    auth: { getSession: async () => SESSION },
    from: (table) => {
      assert.equal(table, 'settlements');
      return {
        insert: (row) => {
          insertedRow = row;
          return Promise.resolve({ error: null });
        },
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [{ id: 's1', amount: 120, notified_at: '2026-09-04T00:00:00Z' }], error: null }),
          }),
        }),
      };
    },
  });

  useEarningsStore.setState({ totalTracked: 120, settlementLog: [], notifying: false, settlementsError: null });
  await useEarningsStore.getState().notifyPsoForSettlement();

  assert.deepEqual(insertedRow, { driver_id: 'driver1', amount: 120 });
  const log = useEarningsStore.getState().settlementLog;
  assert.equal(log.length, 1);
  assert.equal(log[0].amount, 120);
  assert.equal(log[0].id, 's1');
  assert.equal(useEarningsStore.getState().notifying, false);
  assert.equal(useEarningsStore.getState().settlementsError, null);
});

test('notifyPsoForSettlement() sets settlementsError and leaves the log untouched when the insert fails', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    auth: { getSession: async () => SESSION },
    from: () => ({ insert: () => Promise.resolve({ error: { message: 'connection refused' } }) }),
  });

  const priorLog = [{ id: 's0', amount: 50, loggedAt: '2026-09-01T00:00:00Z' }];
  useEarningsStore.setState({ totalTracked: 120, settlementLog: priorLog, notifying: false, settlementsError: null });
  await useEarningsStore.getState().notifyPsoForSettlement();

  assert.equal(useEarningsStore.getState().settlementsError, 'connection refused');
  assert.deepEqual(useEarningsStore.getState().settlementLog, priorLog);
  assert.equal(useEarningsStore.getState().notifying, false);
});

test('notifyPsoForSettlement() is a no-op while already notifying', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    auth: { getSession: async () => SESSION },
    from: () => {
      throw new Error('must not query while already notifying');
    },
  });

  useEarningsStore.setState({ totalTracked: 120, notifying: true });
  await useEarningsStore.getState().notifyPsoForSettlement();
});

test('reset() clears every field back to initial state', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');

  useEarningsStore.setState({
    totalTracked: 500,
    dailyBreakdown: [{ date: '2026-08-20', ridesCompleted: 2, totalCollected: 90 }],
    loading: true,
    error: 'stale error',
    settlementLog: [{ id: 'settle-1', amount: 500, loggedAt: 'now' }],
    settlementsError: 'stale settlements error',
    notifying: true,
  });

  useEarningsStore.getState().reset();

  assert.equal(useEarningsStore.getState().totalTracked, 0);
  assert.deepEqual(useEarningsStore.getState().dailyBreakdown, []);
  assert.equal(useEarningsStore.getState().loading, false);
  assert.equal(useEarningsStore.getState().error, null);
  assert.deepEqual(useEarningsStore.getState().settlementLog, []);
  assert.equal(useEarningsStore.getState().settlementsError, null);
  assert.equal(useEarningsStore.getState().notifying, false);
});
