import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { getFleetRatingAverage, listFlaggedLowRatings } from '../src/admin/ratings.ts';

function fakeClient() {
  return {
    from: (table: string) => {
      if (table === 'v_flagged_low_ratings') {
        return {
          select: () => ({
            order: async (column: string, opts: unknown) => ({
              data: [
                { driver_id: 'd1', full_name: 'Reynaldo Suson', rating_avg: 1.9, rating_count: 27 },
                { driver_id: 'd2', full_name: 'Ferdinand Amaro', rating_avg: 2.6, rating_count: 41 },
              ],
              error: null,
              _order: { column, opts },
            }),
          }),
        };
      }
      if (table === 'users') {
        return {
          select: () => ({
            in: async () => ({
              data: [
                { id: 'd1', status: 'flagged' },
                { id: 'd2', status: 'active' },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'tricycles') {
        return {
          select: () => ({
            in: () => ({
              eq: async () => ({
                data: [
                  { driver_id: 'd1', plate_no: 'GSC-3390' },
                  { driver_id: 'd2', plate_no: 'GSC-2277' },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'trips') {
        return {
          select: () => ({
            in: async () => ({
              data: [{ driver_id: 'd1' }, { driver_id: 'd1' }, { driver_id: 'd2' }],
              error: null,
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any;
}

test('listFlaggedLowRatings maps view rows, joins plate/trip-count/account-status, and orders by rating_avg ascending', async () => {
  __setSupabaseClientForTests(fakeClient());

  const { data, error } = await listFlaggedLowRatings();

  assert.equal(error, null);
  assert.deepEqual(data, [
    { driverId: 'd1', fullName: 'Reynaldo Suson', plateNo: 'GSC-3390', ratingAvg: 1.9, ratingCount: 27, tripCount: 2, accountStatus: 'flagged' },
    { driverId: 'd2', fullName: 'Ferdinand Amaro', plateNo: 'GSC-2277', ratingAvg: 2.6, ratingCount: 41, tripCount: 1, accountStatus: 'active' },
  ]);
});

test('listFlaggedLowRatings returns { data: [], error } when the view query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ order: async () => ({ data: null, error: { message: 'connection refused' } }) }) }),
  } as any);

  const { data, error } = await listFlaggedLowRatings();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('listFlaggedLowRatings returns an empty list without further queries when nobody is flagged', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'v_flagged_low_ratings') return { select: () => ({ order: async () => ({ data: [], error: null }) }) };
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listFlaggedLowRatings();
  assert.deepEqual(data, []);
  assert.equal(error, null);
});

test('getFleetRatingAverage computes the rating-count-weighted mean across drivers with at least one rating', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table !== 'driver_profiles') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          gt: async () => ({
            data: [
              { rating_avg: 4.0, rating_count: 10 },
              { rating_avg: 5.0, rating_count: 5 },
            ],
            error: null,
          }),
        }),
      };
    },
  } as any);

  const { data, error } = await getFleetRatingAverage();
  assert.equal(error, null);
  // (4.0*10 + 5.0*5) / 15 = 65/15
  assert.equal(data, 65 / 15);
});

test('getFleetRatingAverage returns null (not NaN) when no driver has any rating yet', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ gt: async () => ({ data: [], error: null }) }) }),
  } as any);

  const { data, error } = await getFleetRatingAverage();
  assert.equal(error, null);
  assert.equal(data, null);
});

test('getFleetRatingAverage returns { data: null, error } when the query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ gt: async () => ({ data: null, error: { message: 'connection refused' } }) }) }),
  } as any);

  const { data, error } = await getFleetRatingAverage();
  assert.equal(data, null);
  assert.equal(error, 'connection refused');
});
