import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import { estimateFare } from '../src/fare/index.ts';

test('estimateFare quotes on the distance rounded to 2 decimals, the same value the ride stores', async () => {
  let args: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (name: string, a: unknown) => {
        assert.equal(name, 'compute_fare');
        args = a;
        return { data: 16, error: null };
      },
    } as any)
  );
  const result = await estimateFare({ distanceKm: 4.0049999, seats: 1, passengerId: 'p1' });
  assert.equal(args.p_distance_km, 4);
  assert.equal(result.fare, 16);
});

test('estimateFare rounds 4.004 up-side too (4.006 -> 4.01)', async () => {
  let args: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (_n: string, a: unknown) => {
        args = a;
        return { data: 16, error: null };
      },
    } as any)
  );
  await estimateFare({ distanceKm: 4.006, seats: 1 });
  assert.equal(args.p_distance_km, 4.01);
});
