import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/supabase/database.types.ts';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { applyForDiscount } from '../src/discount/index.ts';

/** uploadIdPhoto() reads the file via a real fetch() — stub it so tests never hit the network. */
function stubFetch(): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => ({ arrayBuffer: async () => new ArrayBuffer(0) })) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

test('applyForDiscount removes the already-uploaded front photo when the back upload fails', async () => {
  const restoreFetch = stubFetch();
  const removedCalls: string[][] = [];

  __setSupabaseClientForTests({
    storage: {
      from: () => ({
        upload: async (path: string) =>
          path.includes('-back-') ? { error: { message: 'upload failed' } } : { error: null },
        remove: async (paths: string[]) => {
          removedCalls.push(paths);
          return { error: null };
        },
      }),
    },
    from: () => {
      throw new Error('the DB insert must not run when a photo upload already failed');
    },
  } as unknown as SupabaseClient<Database>);

  const { error } = await applyForDiscount({
    userId: 'u1',
    category: 'pwd',
    frontUri: 'file://front.jpg',
    backUri: 'file://back.jpg',
  });

  restoreFetch();

  assert.equal(error, 'upload failed');
  assert.equal(removedCalls.length, 1);
  assert.equal(removedCalls[0].length, 1);
  assert.ok(removedCalls[0][0].includes('-front-'));
});

test('applyForDiscount removes both uploaded photos when the passenger_discounts insert fails', async () => {
  const restoreFetch = stubFetch();
  const removedCalls: string[][] = [];

  __setSupabaseClientForTests({
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        remove: async (paths: string[]) => {
          removedCalls.push(paths);
          return { error: null };
        },
      }),
    },
    from: () => ({
      insert: async () => ({ error: { code: '23505', message: 'duplicate' } }),
    }),
  } as unknown as SupabaseClient<Database>);

  const { error } = await applyForDiscount({
    userId: 'u1',
    category: 'pwd',
    frontUri: 'file://front.jpg',
    backUri: 'file://back.jpg',
  });

  restoreFetch();

  assert.equal(error, 'You already have a discount application pending or approved.');
  assert.equal(removedCalls.length, 1);
  assert.equal(removedCalls[0].length, 2);
  assert.ok(removedCalls[0][0].includes('-front-'));
  assert.ok(removedCalls[0][1].includes('-back-'));
});

test('applyForDiscount succeeds and never calls remove() when both uploads and the insert succeed', async () => {
  const restoreFetch = stubFetch();
  let removeCalled = false;

  __setSupabaseClientForTests({
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        remove: async () => {
          removeCalled = true;
          return { error: null };
        },
      }),
    },
    from: () => ({
      insert: async () => ({ error: null }),
    }),
  } as unknown as SupabaseClient<Database>);

  const { error } = await applyForDiscount({
    userId: 'u1',
    category: 'pwd',
    frontUri: 'file://front.jpg',
    backUri: 'file://back.jpg',
  });

  restoreFetch();

  assert.equal(error, null);
  assert.equal(removeCalled, false);
});
