import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import {
  countRideRequestsForBarangay,
  createBarangayForAdmin,
  deleteBarangayForAdmin,
  listBarangaysForAdmin,
  updateBarangayForAdmin,
} from '../src/admin/barangays.ts';

const SESSION = { session: { user: { id: 'admin1' } } };

test('listBarangaysForAdmin maps rows, resolves updatedByName via a follow-up users lookup, and orders by name ascending', async () => {
  let capturedOrder: { column: string; opts: unknown } | null = null;

  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'barangays') {
        return {
          select: () => ({
            order: async (column: string, opts: unknown) => {
              capturedOrder = { column, opts };
              return {
                data: [
                  { id: 'b1', name: 'Apopong', cluster: 'red', is_split: false, notes: null, updated_at: '2026-09-08T00:00:00.000Z', updated_by: 'admin1' },
                  { id: 'b2', name: 'Labangal', cluster: null, is_split: true, notes: 'West of Makar traffic signal = Red; East = Melting Pot', updated_at: null, updated_by: null },
                ],
                error: null,
              };
            },
          }),
        };
      }
      if (table === 'users') {
        return { select: () => ({ in: async () => ({ data: [{ id: 'admin1', full_name: 'Rhea Santillan' }], error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listBarangaysForAdmin();

  assert.equal(error, null);
  assert.deepEqual(capturedOrder, { column: 'name', opts: { ascending: true } });
  assert.deepEqual(data, [
    { id: 'b1', name: 'Apopong', cluster: 'red', isSplit: false, notes: null, updatedAt: '2026-09-08T00:00:00.000Z', updatedByName: 'Rhea Santillan' },
    { id: 'b2', name: 'Labangal', cluster: null, isSplit: true, notes: 'West of Makar traffic signal = Red; East = Melting Pot', updatedAt: null, updatedByName: null },
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

test('createBarangayForAdmin inserts the given fields, stamped with the signed-in admin and a timestamp', async () => {
  let captured: Record<string, unknown> | null = null;

  __setSupabaseClientForTests({
    from: () => ({ insert: async (row: Record<string, unknown>) => ((captured = row), { error: null }) }),
    auth: { getSession: async () => ({ data: SESSION }) },
  } as any);

  const { error } = await createBarangayForAdmin({ name: 'New Barangay', cluster: 'white', isSplit: false, notes: null });

  assert.equal(error, null);
  assert.equal(captured!.name, 'New Barangay');
  assert.equal(captured!.cluster, 'white');
  assert.equal(captured!.is_split, false);
  assert.equal(captured!.notes, null);
  assert.equal(captured!.updated_by, 'admin1');
  assert.equal(typeof captured!.updated_at, 'string');
});

test('createBarangayForAdmin surfaces an insert error (e.g. duplicate name)', async () => {
  __setSupabaseClientForTests({
    from: () => ({ insert: async () => ({ error: { message: 'duplicate key value violates unique constraint "barangays_name_key"' } }) }),
    auth: { getSession: async () => ({ data: SESSION }) },
  } as any);

  const { error } = await createBarangayForAdmin({ name: 'Apopong', cluster: 'red', isSplit: false, notes: null });
  assert.match(error ?? '', /duplicate key/);
});

test('updateBarangayForAdmin updates the given row by id, stamped with the signed-in admin and a timestamp', async () => {
  let capturedUpdate: Record<string, unknown> | null = null;
  let capturedEq: [string, string] | null = null;

  __setSupabaseClientForTests({
    from: () => ({
      update: (row: Record<string, unknown>) => {
        capturedUpdate = row;
        return { eq: async (col: string, val: string) => ((capturedEq = [col, val]), { error: null }) };
      },
    }),
    auth: { getSession: async () => ({ data: SESSION }) },
  } as any);

  const { error } = await updateBarangayForAdmin('b1', { name: 'Apopong', cluster: 'apple_green', isSplit: false, notes: 'Reassigned per amendment' });

  assert.equal(error, null);
  assert.equal(capturedUpdate!.name, 'Apopong');
  assert.equal(capturedUpdate!.cluster, 'apple_green');
  assert.equal(capturedUpdate!.is_split, false);
  assert.equal(capturedUpdate!.notes, 'Reassigned per amendment');
  assert.equal(capturedUpdate!.updated_by, 'admin1');
  assert.equal(typeof capturedUpdate!.updated_at, 'string');
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

test('countRideRequestsForBarangay counts ride_requests by pickup_barangay_id with a head-only count query', async () => {
  let capturedEq: [string, string] | null = null;
  let capturedSelectOpts: unknown = null;

  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table !== 'ride_requests') throw new Error(`unexpected table ${table}`);
      return {
        select: (columns: string, opts: unknown) => {
          capturedSelectOpts = opts;
          return { eq: async (col: string, val: string) => ((capturedEq = [col, val]), { count: 7, error: null }) };
        },
      };
    },
  } as any);

  const { rideRequestCount, error } = await countRideRequestsForBarangay('b1');

  assert.equal(error, null);
  assert.equal(rideRequestCount, 7);
  assert.deepEqual(capturedEq, ['pickup_barangay_id', 'b1']);
  assert.deepEqual(capturedSelectOpts, { count: 'exact', head: true });
});

test('countRideRequestsForBarangay surfaces a query error', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ eq: async () => ({ count: null, error: { message: 'connection refused' } }) }) }),
  } as any);

  const { rideRequestCount, error } = await countRideRequestsForBarangay('b1');
  assert.equal(rideRequestCount, null);
  assert.equal(error, 'connection refused');
});
