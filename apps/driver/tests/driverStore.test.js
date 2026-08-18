const test = require('node:test');
const assert = require('node:assert/strict');

test('recordCompletedTrip accumulates todayEarnings and increments todayTrips', async () => {
  const { useDriverStore } = await import('../src/store/useDriverStore.ts');

  useDriverStore.setState({ todayEarnings: 0, todayTrips: 0 });

  useDriverStore.getState().recordCompletedTrip(45);
  useDriverStore.getState().recordCompletedTrip(30);

  assert.equal(useDriverStore.getState().todayEarnings, 75);
  assert.equal(useDriverStore.getState().todayTrips, 2);
});

test('checkAvailability() re-syncs isAvailable from driver_profiles.is_available', async () => {
  const { useDriverStore } = await import('../src/store/useDriverStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'driver1' } } } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { is_available: true }, error: null }) }) }) }),
  });

  useDriverStore.setState({ isAvailable: false });
  await useDriverStore.getState().checkAvailability();

  assert.equal(useDriverStore.getState().isAvailable, true);
});

test('checkAvailability() leaves isAvailable untouched when the backend read fails', async () => {
  const { useDriverStore } = await import('../src/store/useDriverStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'driver1' } } } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'network error' } }) }) }) }),
  });

  useDriverStore.setState({ isAvailable: true });
  await useDriverStore.getState().checkAvailability();

  assert.equal(useDriverStore.getState().isAvailable, true);
});

test('checkRating() re-syncs rating/ratingCount from driver_profiles', async () => {
  const { useDriverStore } = await import('../src/store/useDriverStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'driver1' } } } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { rating_avg: 4.7, rating_count: 12 }, error: null }) }) }) }),
  });

  useDriverStore.setState({ rating: null, ratingCount: 0 });
  await useDriverStore.getState().checkRating();

  assert.equal(useDriverStore.getState().rating, 4.7);
  assert.equal(useDriverStore.getState().ratingCount, 12);
});

test('checkRating() leaves rating untouched when the backend read fails', async () => {
  const { useDriverStore } = await import('../src/store/useDriverStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'driver1' } } } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'network error' } }) }) }) }),
  });

  useDriverStore.setState({ rating: 4.9, ratingCount: 20 });
  await useDriverStore.getState().checkRating();

  assert.equal(useDriverStore.getState().rating, 4.9);
  assert.equal(useDriverStore.getState().ratingCount, 20);
});
