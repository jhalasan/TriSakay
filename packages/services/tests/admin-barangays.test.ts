import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import {
  createBarangayForAdmin,
  deleteBarangayForAdmin,
  listBarangaysForAdmin,
  updateBarangayForAdmin,
} from '../src/admin/barangays.ts';

test('listBarangaysForAdmin maps rows and orders by name ascending', async () => {
  let capturedOrder: { column: string; opts: unknown } | null = null;

  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table !== 'barangays') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          order: async (column: string, opts: unknown) => {
            capturedOrder = { column, opts };
            return {
              data: [
                { id: 'b1', name: 'Apopong', cluster: 'red', is_split: false, notes: null },
                { id: 'b2', name: 'Labangal', cluster: null, is_split: true, notes: 'West of Makar traffic signal = Red; East = Melting Pot' },
              ],
              error: null,
            };
          },
        }),
      };
    },
  } as any);

  const { data, error } = await listBarangaysForAdmin();

  assert.equal(error, null);
  assert.deepEqual(capturedOrder, { column: 'name', opts: { ascending: true } });
  assert.deepEqual(data, [
    { id: 'b1', name: 'Apopong', cluster: 'red', isSplit: false, notes: null },
    { id: 'b2', name: 'Labangal', cluster: null, isSplit: true, notes: 'West of Makar traffic signal = Red; East = Melting Pot' },
  ]);
});

test('listBarangaysForAdmin returns { data: [], error } when the query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ order: async () => ({ data: null, error: { message: 'connection refused' } }) }) }),
  } as any);

  const { data, error } = await listBarangaysForAdmin();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('createBarangayForAdmin inserts the given fields', async () => {
  let captured: Record<string, unknown> | null = null;

  __setSupabaseClientForTests({
    from: () => ({ insert: async (row: Record<string, unknown>) => ((captured = row), { error: null }) }),
  } as any);

  const { error } = await createBarangayForAdmin({ name: 'New Barangay', cluster: 'white', isSplit: false, notes: null });

  assert.equal(error, null);
  assert.deepEqual(captured, { name: 'New Barangay', cluster: 'white', is_split: false, notes: null });
});

test('createBarangayForAdmin surfaces an insert error (e.g. duplicate name)', async () => {
  __setSupabaseClientForTests({
    from: () => ({ insert: async () => ({ error: { message: 'duplicate key value violates unique constraint "barangays_name_key"' } }) }),
  } as any);

  const { error } = await createBarangayForAdmin({ name: 'Apopong', cluster: 'red', isSplit: false, notes: null });
  assert.match(error ?? '', /duplicate key/);
});

test('updateBarangayForAdmin updates the given row by id', async () => {
  let capturedUpdate: Record<string, unknown> | null = null;
  let capturedEq: [string, string] | null = null;

  __setSupabaseClientForTests({
    from: () => ({
      update: (row: Record<string, unknown>) => {
        capturedUpdate = row;
        return { eq: async (col: string, val: string) => ((capturedEq = [col, val]), { error: null }) };
      },
    }),
  } as any);

  const { error } = await updateBarangayForAdmin('b1', { name: 'Apopong', cluster: 'apple_green', isSplit: false, notes: 'Reassigned per amendment' });

  assert.equal(error, null);
  assert.deepEqual(capturedUpdate, { name: 'Apopong', cluster: 'apple_green', is_split: false, notes: 'Reassigned per amendment' });
  assert.deepEqual(capturedEq, ['id', 'b1']);
});

test('deleteBarangayForAdmin deletes the given row by id', async () => {
  let capturedEq: [string, string] | null = null;

  __setSupabaseClientForTests({
    from: () => ({ delete: () => ({ eq: async (col: string, val: string) => ((capturedEq = [col, val]), { error: null }) }) }),
  } as any);

  const { error } = await deleteBarangayForAdmin('b1');

  assert.equal(error, null);
  assert.deepEqual(capturedEq, ['id', 'b1']);
});

test('deleteBarangayForAdmin surfaces a delete error', async () => {
  __setSupabaseClientForTests({
    from: () => ({ delete: () => ({ eq: async () => ({ error: { message: 'Only an Administrator may modify barangay reference data' } }) }) }),
  } as any);

  const { error } = await deleteBarangayForAdmin('b1');
  assert.equal(error, 'Only an Administrator may modify barangay reference data');
});
