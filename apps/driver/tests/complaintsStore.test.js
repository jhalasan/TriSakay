const test = require('node:test');
const assert = require('node:assert/strict');

function fakeClient({ selectResult, insertResult }) {
  return {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'driver1' } } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ order: () => Promise.resolve(selectResult) }) }),
      insert: () => ({
        select: () => ({
          single: async () =>
            insertResult.error ? { data: null, error: insertResult.error } : { data: { id: 'c1' }, error: null },
        }),
      }),
    }),
  };
}

test('load() fetches the driver\'s complaints and collapses DB statuses into the 3-state UI model', async () => {
  const { useComplaintsStore } = await import('../src/store/useComplaintsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests(
    fakeClient({
      selectResult: {
        data: [
          { id: 'c1', subject: 'Overcharged', status: 'open' },
          { id: 'c2', subject: 'Rude behavior', status: 'under_review' },
          { id: 'c3', subject: 'Wrong route', status: 'resolved' },
          { id: 'c4', subject: 'Unsafe driving', status: 'dismissed' },
        ],
        error: null,
      },
    })
  );

  useComplaintsStore.setState({ complaints: [], loading: false, error: null });
  await useComplaintsStore.getState().load();

  const statuses = useComplaintsStore.getState().complaints.map((c) => c.status);
  assert.deepEqual(statuses, ['open', 'review', 'closed', 'closed']);
});

test('load() surfaces an error without touching complaints', async () => {
  const { useComplaintsStore } = await import('../src/store/useComplaintsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests(fakeClient({ selectResult: { data: null, error: { message: 'network error' } } }));

  useComplaintsStore.setState({
    complaints: [{ id: 'stale', subject: 'x', status: 'open' }],
    loading: false,
    error: null,
  });
  await useComplaintsStore.getState().load();

  assert.equal(useComplaintsStore.getState().error, 'network error');
  assert.equal(useComplaintsStore.getState().complaints.length, 1);
  assert.equal(useComplaintsStore.getState().complaints[0].id, 'stale');
});

test('submit() re-fetches from the backend on success instead of guessing the new row locally', async () => {
  const { useComplaintsStore } = await import('../src/store/useComplaintsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests(
    fakeClient({
      insertResult: { error: null },
      selectResult: { data: [{ id: 'c1', subject: 'Overcharged', status: 'open' }], error: null },
    })
  );

  useComplaintsStore.setState({ complaints: [], loading: false, error: null });
  const result = await useComplaintsStore.getState().submit('Overcharged', 'Details here');

  assert.equal(result.ok, true);
  assert.equal(result.attachmentError, null);
  assert.equal(useComplaintsStore.getState().complaints.length, 1);
  assert.equal(useComplaintsStore.getState().complaints[0].id, 'c1');
});

test('submit() sets error and does not re-fetch when the insert fails', async () => {
  const { useComplaintsStore } = await import('../src/store/useComplaintsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests(fakeClient({ insertResult: { error: { message: 'network error' } } }));

  useComplaintsStore.setState({ complaints: [], loading: false, error: null });
  const result = await useComplaintsStore.getState().submit('Overcharged', 'Details here');

  assert.equal(result.ok, false);
  assert.equal(useComplaintsStore.getState().error, 'network error');
  assert.equal(useComplaintsStore.getState().complaints.length, 0);
});

test('reset() clears complaints, loading, and error back to initial state', async () => {
  const { useComplaintsStore } = await import('../src/store/useComplaintsStore.ts');

  useComplaintsStore.setState({
    complaints: [{ id: 'c1', subject: 'x', status: 'open' }],
    loading: true,
    error: 'stale error',
  });

  useComplaintsStore.getState().reset();

  assert.deepEqual(useComplaintsStore.getState().complaints, []);
  assert.equal(useComplaintsStore.getState().loading, false);
  assert.equal(useComplaintsStore.getState().error, null);
});
