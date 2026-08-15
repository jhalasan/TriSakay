import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { approveDiscount, listPendingDiscounts, rejectDiscount } from '../src/admin/discounts.ts';

function fakeClient() {
  return {
    from: (table: string) => {
      if (table === 'passenger_discounts') {
        return {
          select: () => ({
            order: async () => ({
              data: [
                {
                  id: 'disc1',
                  passenger_id: 'p1',
                  category: 'senior_citizen',
                  status: 'pending',
                  submitted_at: '2026-08-01T00:00:00.000Z',
                  remarks: null,
                  id_photo_front_path: 'discounts/p1/front.jpg',
                  id_photo_back_path: 'discounts/p1/back.jpg',
                },
              ],
              error: null,
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: async (_col: string, id: string) => {
              (globalThis as any).__capturedUpdate = { table, id, patch };
              return { error: null };
            },
          }),
        };
      }
      if (table === 'users') {
        return { select: () => ({ in: async () => ({ data: [{ id: 'p1', full_name: 'Corazon Miralles' }], error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
    auth: { getSession: async () => ({ data: { session: { user: { id: 'reviewer-1' } } } }) },
  } as any;
}

test('listPendingDiscounts maps rows and resolves passengerName', async () => {
  __setSupabaseClientForTests(fakeClient());

  const { data, error } = await listPendingDiscounts();

  assert.equal(error, null);
  assert.deepEqual(data, [
    {
      id: 'disc1',
      passengerId: 'p1',
      passengerName: 'Corazon Miralles',
      category: 'senior_citizen',
      status: 'pending',
      submittedAt: '2026-08-01T00:00:00.000Z',
      remarks: null,
      idPhotoFrontPath: 'discounts/p1/front.jpg',
      idPhotoBackPath: 'discounts/p1/back.jpg',
    },
  ]);
});

test('listPendingDiscounts returns { data: [], error } when the query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ order: async () => ({ data: null, error: { message: 'connection refused' } }) }) }),
  } as any);

  const { data, error } = await listPendingDiscounts();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('approveDiscount writes status=approved with the signed-in reviewer id', async () => {
  __setSupabaseClientForTests(fakeClient());

  const { error } = await approveDiscount('disc1', 'Verified ID at PSO office');
  assert.equal(error, null);

  const captured = (globalThis as any).__capturedUpdate;
  assert.equal(captured.id, 'disc1');
  assert.equal(captured.patch.status, 'approved');
  assert.equal(captured.patch.reviewed_by, 'reviewer-1');
  assert.equal(captured.patch.remarks, 'Verified ID at PSO office');
});

test('rejectDiscount writes status=rejected', async () => {
  __setSupabaseClientForTests(fakeClient());

  const { error } = await rejectDiscount('disc1', 'ID photo unreadable');
  assert.equal(error, null);

  const captured = (globalThis as any).__capturedUpdate;
  assert.equal(captured.patch.status, 'rejected');
  assert.equal(captured.patch.remarks, 'ID photo unreadable');
});

test('approveDiscount surfaces an error when there is no active session', async () => {
  __setSupabaseClientForTests({
    from: () => ({}),
    auth: { getSession: async () => ({ data: { session: null } }) },
  } as any);

  const { error } = await approveDiscount('disc1');
  assert.equal(error, 'Not signed in');
});
