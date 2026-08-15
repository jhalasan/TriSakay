import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { listFlaggedLowRatings } from '../src/admin/ratings.ts';

test('listFlaggedLowRatings maps view rows and orders by rating_avg ascending', async () => {
  let capturedOrder: { column: string; opts: unknown } | null = null;

  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table !== 'v_flagged_low_ratings') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          order: async (column: string, opts: unknown) => {
            capturedOrder = { column, opts };
            return {
              data: [
                { driver_id: 'd1', full_name: 'Reynaldo Suson', rating_avg: 1.9, rating_count: 27 },
                { driver_id: 'd2', full_name: 'Ferdinand Amaro', rating_avg: 2.6, rating_count: 41 },
              ],
              error: null,
            };
          },
        }),
      };
    },
  } as any);

  const { data, error } = await listFlaggedLowRatings();

  assert.equal(error, null);
  assert.deepEqual(data, [
    { driverId: 'd1', fullName: 'Reynaldo Suson', ratingAvg: 1.9, ratingCount: 27 },
    { driverId: 'd2', fullName: 'Ferdinand Amaro', ratingAvg: 2.6, ratingCount: 41 },
  ]);
  assert.deepEqual(capturedOrder, { column: 'rating_avg', opts: { ascending: true } });
});

test('listFlaggedLowRatings returns { data: [], error } when the view query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ order: async () => ({ data: null, error: { message: 'connection refused' } }) }) }),
  } as any);

  const { data, error } = await listFlaggedLowRatings();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});
