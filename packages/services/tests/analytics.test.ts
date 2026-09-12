import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import { getDriverPeakHourHistogram } from '../src/analytics/index.ts';

test('getDriverPeakHourHistogram maps 12 buckets to hour-range labels, calling the RPC with the given since-date', async () => {
  let capturedArgs: unknown = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn, args) => {
        assert.equal(fn, 'get_peak_hour_histogram');
        capturedArgs = args;
        return {
          data: Array.from({ length: 12 }, (_, i) => ({ bucket_index: i, bucket_count: i === 3 ? 7 : 0 })),
          error: null,
        };
      },
    })
  );

  const { data, error } = await getDriverPeakHourHistogram('2026-08-01T00:00:00.000Z');

  assert.equal(error, null);
  assert.deepEqual(capturedArgs, { p_since: '2026-08-01T00:00:00.000Z' });
  assert.equal(data.length, 12);
  assert.deepEqual(data[3], { hourLabel: '6:00 AM–8:00 AM', count: 7 });
  assert.equal(data[0].count, 0);
});

test('getDriverPeakHourHistogram surfaces an RPC error instead of guessing', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async () => ({ data: null, error: { message: 'network down' } }),
    })
  );

  const { data, error } = await getDriverPeakHourHistogram('2026-08-01T00:00:00.000Z');

  assert.equal(error, 'network down');
  assert.deepEqual(data, []);
});

test('getDriverPeakHourHistogram fills a missing bucket with 0 rather than dropping it', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      // Only 11 rows returned — bucket 5 missing, simulating a defensive
      // client-side fill if the RPC's own generate_series ever regresses.
      rpc: async () => ({
        data: Array.from({ length: 12 }, (_, i) => i).filter((i) => i !== 5).map((i) => ({ bucket_index: i, bucket_count: 2 })),
        error: null,
      }),
    })
  );

  const { data, error } = await getDriverPeakHourHistogram('2026-08-01T00:00:00.000Z');

  assert.equal(error, null);
  assert.equal(data.length, 12);
  assert.equal(data[5].count, 0);
});
