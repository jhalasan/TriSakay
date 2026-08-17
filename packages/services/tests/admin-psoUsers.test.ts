import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createPsoUserForAdmin, listPsoUsersForAdmin } from '../src/admin/psoUsers.ts';

test('listPsoUsersForAdmin maps status to isActive and passes role through', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table !== 'users') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          in: () => ({
            order: async () => ({
              data: [
                { id: 'u1', full_name: 'Rodel Fernandez', email: 'r.fernandez@pso.gensantos.gov.ph', role: 'admin', status: 'active', created_at: '2024-09-01T00:00:00.000Z' },
                { id: 'u2', full_name: 'Jasmin Oclarit', email: 'j.oclarit@pso.gensantos.gov.ph', role: 'pso_staff', status: 'suspended', created_at: '2025-05-20T00:00:00.000Z' },
              ],
              error: null,
            }),
          }),
        }),
      };
    },
  } as any);

  const { data, error } = await listPsoUsersForAdmin();
  assert.equal(error, null);
  assert.deepEqual(data, [
    { id: 'u1', fullName: 'Rodel Fernandez', email: 'r.fernandez@pso.gensantos.gov.ph', role: 'admin', isActive: true, createdAt: '2024-09-01T00:00:00.000Z' },
    { id: 'u2', fullName: 'Jasmin Oclarit', email: 'j.oclarit@pso.gensantos.gov.ph', role: 'pso_staff', isActive: false, createdAt: '2025-05-20T00:00:00.000Z' },
  ]);
});

test('listPsoUsersForAdmin returns { data: [], error } when the query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ in: () => ({ order: async () => ({ data: null, error: { message: 'connection refused' } }) }) }) }),
  } as any);

  const { data, error } = await listPsoUsersForAdmin();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('createPsoUserForAdmin invokes the admin-create-pso-user Edge Function and returns the temp password', async () => {
  let captured: { fn: string; body: unknown } | null = null;
  __setSupabaseClientForTests({
    functions: {
      invoke: async (fn: string, opts: { body: unknown }) => {
        captured = { fn, body: opts.body };
        return { data: { userId: 'new1', tempPassword: 'Tq7!abc123', error: null }, error: null };
      },
    },
  } as any);

  const { userId, tempPassword, error } = await createPsoUserForAdmin({ fullName: 'Test User', email: 'test@example.com', role: 'pso_staff' });
  assert.equal(error, null);
  assert.equal(userId, 'new1');
  assert.equal(tempPassword, 'Tq7!abc123');
  assert.equal(captured!.fn, 'admin-create-pso-user');
  assert.deepEqual(captured!.body, { fullName: 'Test User', email: 'test@example.com', role: 'pso_staff' });
});

test('createPsoUserForAdmin surfaces the Edge Function\'s in-body error message on a non-2xx response', async () => {
  __setSupabaseClientForTests({
    functions: {
      invoke: async () => ({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: { json: async () => ({ userId: null, tempPassword: null, error: 'Only an Administrator may create PSO accounts' }) },
        },
      }),
    },
  } as any);

  const { userId, tempPassword, error } = await createPsoUserForAdmin({ fullName: 'Test User', email: 'test@example.com', role: 'admin' });
  assert.equal(userId, null);
  assert.equal(tempPassword, null);
  assert.equal(error, 'Only an Administrator may create PSO accounts');
});

test('createPsoUserForAdmin falls back to the generic error message when the response body has no error field', async () => {
  __setSupabaseClientForTests({
    functions: {
      invoke: async () => ({
        data: null,
        error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({}) } },
      }),
    },
  } as any);

  const { error } = await createPsoUserForAdmin({ fullName: 'Test User', email: 'test@example.com', role: 'pso_staff' });
  assert.equal(error, 'Edge Function returned a non-2xx status code');
});
