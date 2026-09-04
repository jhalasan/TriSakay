import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { notifyPsoForSettlement, listMySettlements } from '../src/settlements/index.ts';

const SESSION = { session: { user: { id: 'driver1' } } };

test('notifyPsoForSettlement inserts driver_id from the signed-in session, with the given amount', async () => {
  let captured: Record<string, unknown> | null = null;
  __setSupabaseClientForTests({
    from: (table: string) => {
      assert.equal(table, 'settlements');
      return {
        insert: async (row: Record<string, unknown>) => {
          captured = row;
          return { error: null };
        },
      };
    },
    auth: { getSession: async () => ({ data: SESSION }) },
  } as any);

  const { error } = await notifyPsoForSettlement(180.5);

  assert.equal(error, null);
  assert.deepEqual(captured, { driver_id: 'driver1', amount: 180.5 });
});

test('notifyPsoForSettlement returns an error without inserting when there is no active session', async () => {
  __setSupabaseClientForTests({
    from: () => {
      throw new Error('must not query when there is no session');
    },
    auth: { getSession: async () => ({ data: { session: null } }) },
  } as any);

  const { error } = await notifyPsoForSettlement(100);

  assert.equal(error, 'Not signed in');
});

test('notifyPsoForSettlement surfaces an insert error', async () => {
  __setSupabaseClientForTests({
    from: () => ({ insert: async () => ({ error: { message: 'connection refused' } }) }),
    auth: { getSession: async () => ({ data: SESSION }) },
  } as any);

  const { error } = await notifyPsoForSettlement(50);

  assert.equal(error, 'connection refused');
});

test('listMySettlements returns the signed-in driver own rows, newest first, mapped to camelCase', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      assert.equal(table, 'settlements');
      return {
        select: () => ({
          eq: (column: string, value: string) => {
            assert.equal(column, 'driver_id');
            assert.equal(value, 'driver1');
            return {
              order: async (column: string, opts: { ascending: boolean }) => {
                assert.equal(column, 'notified_at');
                assert.equal(opts.ascending, false);
                return {
                  data: [{ id: 's1', amount: 180.5, notified_at: '2026-09-04T00:00:00Z' }],
                  error: null,
                };
              },
            };
          },
        }),
      };
    },
    auth: { getSession: async () => ({ data: SESSION }) },
  } as any);

  const { data, error } = await listMySettlements();

  assert.equal(error, null);
  assert.deepEqual(data, [{ id: 's1', amount: 180.5, notifiedAt: '2026-09-04T00:00:00Z' }]);
});

test('listMySettlements returns an empty array and the error message on query failure', async () => {
  __setSupabaseClientForTests({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: async () => ({ data: null, error: { message: 'connection refused' } }),
        }),
      }),
    }),
    auth: { getSession: async () => ({ data: SESSION }) },
  } as any);

  const { data, error } = await listMySettlements();

  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('listMySettlements returns an error when there is no active session', async () => {
  __setSupabaseClientForTests({
    from: () => {
      throw new Error('must not query when there is no session');
    },
    auth: { getSession: async () => ({ data: { session: null } }) },
  } as any);

  const { data, error } = await listMySettlements();

  assert.deepEqual(data, []);
  assert.equal(error, 'Not signed in');
});
