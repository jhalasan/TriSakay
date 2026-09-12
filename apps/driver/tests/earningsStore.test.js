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

function peakHourRpc(bucketCounts) {
  return async (fn, args) => {
    assert.equal(fn, 'get_peak_hour_histogram');
    assert.ok(typeof args.p_since === 'string');
    return { data: bucketCounts.map((count, i) => ({ bucket_index: i, bucket_count: count })), error: null };
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
        : {},
    rpc: peakHourRpc(new Array(12).fill(0)),
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

test('load() also populates peakHours from the real RPC call, 12 buckets', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    auth: { getSession: async () => SESSION },
    from: (table) => (table === 'v_driver_earnings' ? driverEarningsView([]) : {}),
    rpc: peakHourRpc([0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 0, 0]),
  });

  useEarningsStore.setState({ peakHours: [], peakHoursError: null });
  await useEarningsStore.getState().load();

  const peakHours = useEarningsStore.getState().peakHours;
  assert.equal(peakHours.length, 12);
  assert.equal(peakHours[3].count, 7);
  assert.equal(useEarningsStore.getState().peakHoursError, null);
});

test('load() reports 0 total and an empty breakdown when there are no rows yet', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    auth: { getSession: async () => SESSION },
    from: (table) => (table === 'v_driver_earnings' ? driverEarningsView([]) : {}),
    rpc: peakHourRpc(new Array(12).fill(0)),
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
    rpc: peakHourRpc(new Array(12).fill(0)),
  });

  const priorBreakdown = [{ date: '2026-08-18', ridesCompleted: 1, totalCollected: 10 }];
  useEarningsStore.setState({ totalTracked: 10, dailyBreakdown: priorBreakdown, error: null });
  await useEarningsStore.getState().load();

  assert.equal(useEarningsStore.getState().error, 'network down');
  assert.equal(useEarningsStore.getState().totalTracked, 10);
  assert.deepEqual(useEarningsStore.getState().dailyBreakdown, priorBreakdown);
});

test('load() surfaces a peak-hours RPC error without touching earnings state', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    auth: { getSession: async () => SESSION },
    from: (table) => (table === 'v_driver_earnings' ? driverEarningsView([]) : {}),
    rpc: async () => ({ data: null, error: { message: 'rpc down' } }),
  });

  useEarningsStore.setState({ peakHours: [{ hourLabel: 'x', count: 1 }], peakHoursError: null });
  await useEarningsStore.getState().load();

  assert.equal(useEarningsStore.getState().peakHoursError, 'rpc down');
  assert.equal(useEarningsStore.getState().error, null);
});

test('reset() clears every field back to initial state', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');

  useEarningsStore.setState({
    totalTracked: 500,
    dailyBreakdown: [{ date: '2026-08-20', ridesCompleted: 2, totalCollected: 90 }],
    loading: true,
    error: 'stale error',
    peakHours: [{ hourLabel: 'x', count: 1 }],
    peakHoursError: 'stale peak-hours error',
  });

  useEarningsStore.getState().reset();

  assert.equal(useEarningsStore.getState().totalTracked, 0);
  assert.deepEqual(useEarningsStore.getState().dailyBreakdown, []);
  assert.equal(useEarningsStore.getState().loading, false);
  assert.equal(useEarningsStore.getState().error, null);
  assert.deepEqual(useEarningsStore.getState().peakHours, []);
  assert.equal(useEarningsStore.getState().peakHoursError, null);
});
