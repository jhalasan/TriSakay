const test = require('node:test');
const assert = require('node:assert/strict');

const SESSION = { data: { session: { user: { id: 'driver1' } } } };

function driverRatingsTable(rows) {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: () => Promise.resolve({ data: rows, error: null }),
  };
  return query;
}

test('load() maps rows from the real service call', async () => {
  const { useRatingsStore } = await import('../src/store/useRatingsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    auth: { getSession: async () => SESSION },
    from: (table) =>
      table === 'ratings'
        ? driverRatingsTable([
            { id: 'r1', ride_request_id: 'rr1', stars: 5, comment: 'Great!', created_at: '2026-08-20T00:00:00.000Z' },
            { id: 'r2', ride_request_id: 'rr2', stars: 3, comment: null, created_at: '2026-08-18T00:00:00.000Z' },
          ])
        : {},
  });

  useRatingsStore.setState({ ratings: [], error: null });
  await useRatingsStore.getState().load();

  assert.deepEqual(useRatingsStore.getState().ratings, [
    { id: 'r1', stars: 5, comment: 'Great!', createdAt: '2026-08-20T00:00:00.000Z' },
    { id: 'r2', stars: 3, comment: null, createdAt: '2026-08-18T00:00:00.000Z' },
  ]);
  assert.equal(useRatingsStore.getState().error, null);
});

test('load() reports an empty list when the driver has no ratings yet', async () => {
  const { useRatingsStore } = await import('../src/store/useRatingsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    auth: { getSession: async () => SESSION },
    from: (table) => (table === 'ratings' ? driverRatingsTable([]) : {}),
  });

  useRatingsStore.setState({ ratings: [{ id: 'stale', stars: 1, comment: null, createdAt: 'x' }], error: null });
  await useRatingsStore.getState().load();

  assert.deepEqual(useRatingsStore.getState().ratings, []);
});

test('load() surfaces a query error and leaves prior ratings alone', async () => {
  const { useRatingsStore } = await import('../src/store/useRatingsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    auth: { getSession: async () => SESSION },
    from: (table) =>
      table === 'ratings'
        ? { select: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: null, error: { message: 'network down' } }) }) }) }) }
        : {},
  });

  const priorRatings = [{ id: 'r1', stars: 5, comment: null, createdAt: 'x' }];
  useRatingsStore.setState({ ratings: priorRatings, error: null });
  await useRatingsStore.getState().load();

  assert.equal(useRatingsStore.getState().error, 'network down');
  assert.deepEqual(useRatingsStore.getState().ratings, priorRatings);
});

test('reset() clears ratings, loading, and error back to initial state', async () => {
  const { useRatingsStore } = await import('../src/store/useRatingsStore.ts');

  useRatingsStore.setState({
    ratings: [{ id: 'r1', stars: 5, comment: null, createdAt: 'now' }],
    loading: true,
    error: 'stale error',
  });

  useRatingsStore.getState().reset();

  assert.deepEqual(useRatingsStore.getState().ratings, []);
  assert.equal(useRatingsStore.getState().loading, false);
  assert.equal(useRatingsStore.getState().error, null);
});
