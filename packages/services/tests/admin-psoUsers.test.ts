import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createPsoUserForAdmin, listPsoUserSessions, listPsoUsersForAdmin, revokePsoUserSession } from '../src/admin/psoUsers.ts';

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

test('listPsoUserSessions calls admin_list_user_sessions with the given user id and maps rows', async () => {
  let capturedArgs: Record<string, unknown> | null = null;

  __setSupabaseClientForTests({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (fn !== 'admin_list_user_sessions') throw new Error(`unexpected rpc ${fn}`);
      capturedArgs = args;
      return {
        data: [
          { id: 's1', created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-09T08:00:00.000Z', user_agent: 'Mozilla/5.0', ip: '203.0.113.5' },
        ],
        error: null,
      };
    },
  } as any);

  const { data, error } = await listPsoUserSessions('u1');

  assert.equal(error, null);
  assert.deepEqual(capturedArgs, { p_user_id: 'u1' });
  assert.deepEqual(data, [
    { id: 's1', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-09T08:00:00.000Z', userAgent: 'Mozilla/5.0', ip: '203.0.113.5' },
  ]);
});

test('listPsoUserSessions returns { data: [], error } when the RPC fails (e.g. non-Administrator caller)', async () => {
  __setSupabaseClientForTests({
    rpc: async () => ({ data: null, error: { message: 'Only an Administrator may view session data' } }),
  } as any);

  const { data, error } = await listPsoUserSessions('u1');
  assert.deepEqual(data, []);
  assert.equal(error, 'Only an Administrator may view session data');
});

test('revokePsoUserSession calls admin_revoke_user_session with the given session id', async () => {
  let capturedArgs: Record<string, unknown> | null = null;

  __setSupabaseClientForTests({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (fn !== 'admin_revoke_user_session') throw new Error(`unexpected rpc ${fn}`);
      capturedArgs = args;
      return { error: null };
    },
  } as any);

  const { error } = await revokePsoUserSession('s1');

  assert.equal(error, null);
  assert.deepEqual(capturedArgs, { p_session_id: 's1' });
});

test('revokePsoUserSession surfaces an RPC error (e.g. non-Administrator caller)', async () => {
  __setSupabaseClientForTests({
    rpc: async () => ({ error: { message: 'Only an Administrator may revoke a session' } }),
  } as any);

  const { error } = await revokePsoUserSession('s1');
  assert.equal(error, 'Only an Administrator may revoke a session');
});
