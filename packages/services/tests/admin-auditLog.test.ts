import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { listAccountActions } from '../src/admin/auditLog.ts';

test('listAccountActions orders by created_at desc and resolves target/performer names', async () => {
  let capturedOrder: { column: string; opts: unknown } | null = null;
  let capturedInIds: string[] | null = null;

  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'account_actions') {
        return {
          select: () => ({
            order: async (column: string, opts: unknown) => {
              capturedOrder = { column, opts };
              return {
                data: [
                  {
                    id: 'a1',
                    target_user_id: 'u1',
                    action_type: 'suspend',
                    performed_by: 'u2',
                    reason: 'Repeated no-shows',
                    complaint_id: null,
                    created_at: '2026-09-09T10:00:00Z',
                  },
                  {
                    id: 'a2',
                    target_user_id: 'u3',
                    action_type: 'flag',
                    performed_by: 'u2',
                    reason: 'Passenger complaint filed',
                    complaint_id: 'c1',
                    created_at: '2026-09-08T09:00:00Z',
                  },
                ],
                error: null,
              };
            },
          }),
        };
      }
      if (table === 'users') {
        return {
          select: () => ({
            in: async (_column: string, ids: string[]) => {
              capturedInIds = ids;
              return {
                data: [
                  { id: 'u1', full_name: 'Reynaldo Suson' },
                  { id: 'u2', full_name: 'Engr. Wilhelmina Nazareno' },
                  { id: 'u3', full_name: 'Juan Dela Cruz' },
                ],
                error: null,
              };
            },
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listAccountActions();

  assert.equal(error, null);
  assert.deepEqual(capturedOrder, { column: 'created_at', opts: { ascending: false } });
  assert.deepEqual(new Set(capturedInIds ?? []), new Set(['u1', 'u2', 'u3']));
  assert.deepEqual(data, [
    {
      id: 'a1',
      actionType: 'suspend',
      targetUserId: 'u1',
      targetUserName: 'Reynaldo Suson',
      performedBy: 'u2',
      performedByName: 'Engr. Wilhelmina Nazareno',
      reason: 'Repeated no-shows',
      complaintId: null,
      createdAt: '2026-09-09T10:00:00Z',
    },
    {
      id: 'a2',
      actionType: 'flag',
      targetUserId: 'u3',
      targetUserName: 'Juan Dela Cruz',
      performedBy: 'u2',
      performedByName: 'Engr. Wilhelmina Nazareno',
      reason: 'Passenger complaint filed',
      complaintId: 'c1',
      createdAt: '2026-09-08T09:00:00Z',
    },
  ]);
});

test('listAccountActions degrades a missing name to null instead of failing the row', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'account_actions') {
        return {
          select: () => ({
            order: async () => ({
              data: [
                {
                  id: 'a1',
                  target_user_id: 'u1',
                  action_type: 'deactivate',
                  performed_by: 'u2',
                  reason: 'Franchise revoked',
                  complaint_id: null,
                  created_at: '2026-09-09T10:00:00Z',
                },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'users') {
        return { select: () => ({ in: async () => ({ data: [], error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listAccountActions();

  assert.equal(error, null);
  assert.equal(data[0].targetUserName, null);
  assert.equal(data[0].performedByName, null);
});

test('listAccountActions returns { data: [], error } when the query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ order: async () => ({ data: null, error: { message: 'connection refused' } }) }) }),
  } as any);

  const { data, error } = await listAccountActions();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('listAccountActions skips the users lookup entirely when there are no rows', async () => {
  let usersQueried = false;
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'account_actions') return { select: () => ({ order: async () => ({ data: [], error: null }) }) };
      if (table === 'users') {
        usersQueried = true;
        return { select: () => ({ in: async () => ({ data: [], error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listAccountActions();
  assert.deepEqual(data, []);
  assert.equal(error, null);
  assert.equal(usersQueried, false);
});
