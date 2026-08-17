import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import {
  approveVerification,
  listPendingVerifications,
  rejectVerification,
  updateVerificationFields,
} from '../src/admin/verification.ts';

function fakeClient() {
  return {
    from: (table: string) => {
      if (table === 'driver_profiles') {
        return {
          select: () => ({
            neq: () => ({
              order: async () => ({
                data: [{ user_id: 'drv1', verification_status: 'pending' }],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'users') {
        return { select: () => ({ in: async () => ({ data: [{ id: 'drv1', full_name: 'Ariel Cabahug' }], error: null }) }) };
      }
      if (table === 'tricycles') {
        return {
          select: () => ({
            in: () => ({
              eq: async () => ({
                data: [
                  { id: 'tri1', driver_id: 'drv1', plate_no: 'GSC-1187', mtop_no: null, mtop_expiry_date: null, cluster: null },
                ],
                error: null,
              }),
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: () => ({
              eq: async () => {
                (globalThis as any).__capturedTricycleUpdate = { patch };
                return { error: null };
              },
            }),
          }),
        };
      }
      if (table === 'driver_documents') {
        return {
          select: () => ({
            in: async () => ({
              data: [
                { id: 'doc1', driver_id: 'drv1', doc_type: 'drivers_license', status: 'pending', storage_path: 'a.jpg', remarks: null },
                { id: 'doc2', driver_id: 'drv1', doc_type: 'or_cr', status: 'pending', storage_path: 'b.jpg', remarks: null },
              ],
              error: null,
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: async (fn: string, args: unknown) => {
      (globalThis as any).__capturedRpc = { fn, args };
      return { data: null, error: null };
    },
  } as any;
}

test('listPendingVerifications maps a pending driver with its tricycle and documents', async () => {
  __setSupabaseClientForTests(fakeClient());

  const { data, error } = await listPendingVerifications();

  assert.equal(error, null);
  assert.deepEqual(data, [
    {
      driverId: 'drv1',
      driverFullName: 'Ariel Cabahug',
      tricycleId: 'tri1',
      plateNo: 'GSC-1187',
      mtopNo: null,
      mtopExpiryDate: null,
      cluster: null,
      overallStatus: 'pending',
      notes: null,
      documents: [
        { id: 'doc1', docType: 'drivers_license', status: 'pending', storagePath: 'a.jpg' },
        { id: 'doc2', docType: 'or_cr', status: 'pending', storagePath: 'b.jpg' },
      ],
    },
  ]);
});

test('listPendingVerifications returns { data: [], error } when the driver_profiles query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ neq: () => ({ order: async () => ({ data: null, error: { message: 'connection refused' } }) }) }) }),
  } as any);

  const { data, error } = await listPendingVerifications();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('listPendingVerifications returns an empty list without further queries when there are no pending cases', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'driver_profiles') return { select: () => ({ neq: () => ({ order: async () => ({ data: [], error: null }) }) }) };
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listPendingVerifications();
  assert.deepEqual(data, []);
  assert.equal(error, null);
});

test('listPendingVerifications includes already-decided cases, not just pending ones', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'driver_profiles') {
        return {
          select: () => ({
            neq: (_col: string, value: string) => {
              assert.equal(value, 'unsubmitted');
              return {
                order: async () => ({
                  data: [{ user_id: 'drv1', verification_status: 'approved' }],
                  error: null,
                }),
              };
            },
          }),
        };
      }
      if (table === 'users') return { select: () => ({ in: async () => ({ data: [{ id: 'drv1', full_name: 'Ariel Cabahug' }], error: null }) }) };
      if (table === 'tricycles') return { select: () => ({ in: () => ({ eq: async () => ({ data: [], error: null }) }) }) };
      if (table === 'driver_documents') return { select: () => ({ in: async () => ({ data: [], error: null }) }) };
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listPendingVerifications();
  assert.equal(error, null);
  assert.equal(data[0].overallStatus, 'approved');
});

test('updateVerificationFields writes only the provided fields, scoped to the driver\'s active tricycle', async () => {
  __setSupabaseClientForTests(fakeClient());

  const { error } = await updateVerificationFields('drv1', { mtopNo: 'MTOP-2026-00123', cluster: 'melting_pot' });
  assert.equal(error, null);

  const captured = (globalThis as any).__capturedTricycleUpdate;
  assert.deepEqual(captured.patch, { mtop_no: 'MTOP-2026-00123', cluster: 'melting_pot' });
});

test('approveVerification calls perform_verification_decision with the approved decision', async () => {
  __setSupabaseClientForTests(fakeClient());

  const { error } = await approveVerification('drv1', 'Franchise confirmed at PSO office');
  assert.equal(error, null);

  const captured = (globalThis as any).__capturedRpc;
  assert.equal(captured.fn, 'perform_verification_decision');
  assert.equal(captured.args.p_driver_id, 'drv1');
  assert.equal(captured.args.p_decision, 'approved');
  assert.equal(captured.args.p_notes, 'Franchise confirmed at PSO office');
});

test('rejectVerification calls perform_verification_decision with the rejected decision', async () => {
  __setSupabaseClientForTests(fakeClient());

  const { error } = await rejectVerification('drv1', 'Franchise permit expired');
  assert.equal(error, null);

  const captured = (globalThis as any).__capturedRpc;
  assert.equal(captured.fn, 'perform_verification_decision');
  assert.equal(captured.args.p_decision, 'rejected');
  assert.equal(captured.args.p_notes, 'Franchise permit expired');
});

test('approveVerification surfaces an RPC error', async () => {
  __setSupabaseClientForTests({
    rpc: async () => ({ data: null, error: { message: 'Only a PSO Supervisor or Admin may approve or reject a verification case' } }),
  } as any);

  const { error } = await approveVerification('drv1');
  assert.equal(error, 'Only a PSO Supervisor or Admin may approve or reject a verification case');
});
