import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { listAccountActions, listReviewDecisions } from '../src/admin/auditLog.ts';

test('listAccountActions orders by created_at desc, caps rows, and resolves target/performer names', async () => {
  let capturedOrder: { column: string; opts: unknown } | null = null;
  let capturedLimit: number | null = null;
  let capturedInIds: string[] | null = null;

  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'account_actions') {
        return {
          select: () => ({
            order: (column: string, opts: unknown) => {
              capturedOrder = { column, opts };
              return {
                limit: async (n: number) => {
                  capturedLimit = n;
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

  const { data, error, truncated } = await listAccountActions();

  assert.equal(error, null);
  assert.equal(truncated, false);
  assert.deepEqual(capturedOrder, { column: 'created_at', opts: { ascending: false } });
  assert.equal(capturedLimit, 2000);
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

test('listAccountActions applies a since-filter when a date-range cutoff is given', async () => {
  let capturedSince: string | null = null;
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'account_actions') {
        return {
          select: () => ({
            order: () => ({
              limit: () => ({
                gte: async (_column: string, value: string) => {
                  capturedSince = value;
                  return { data: [], error: null };
                },
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const cutoff = '2026-09-08T00:00:00.000Z';
  const { data, error } = await listAccountActions(cutoff);

  assert.equal(error, null);
  assert.deepEqual(data, []);
  assert.equal(capturedSince, cutoff);
});

test('listAccountActions reports truncated: true when the row cap is hit', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'account_actions') {
        return {
          select: () => ({
            order: () => ({
              limit: async () => ({
                data: Array.from({ length: 2000 }, (_, i) => ({
                  id: `a${i}`,
                  target_user_id: 'u1',
                  action_type: 'flag',
                  performed_by: 'u2',
                  reason: 'x',
                  complaint_id: null,
                  created_at: '2026-09-09T10:00:00Z',
                })),
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'users') return { select: () => ({ in: async () => ({ data: [], error: null }) }) };
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { truncated } = await listAccountActions();
  assert.equal(truncated, true);
});

test('listAccountActions degrades a missing name to null instead of failing the row', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'account_actions') {
        return {
          select: () => ({
            order: () => ({
              limit: async () => ({
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
    from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: null, error: { message: 'connection refused' } }) }) }) }),
  } as any);

  const { data, error } = await listAccountActions();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('listAccountActions skips the users lookup entirely when there are no rows', async () => {
  let usersQueried = false;
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'account_actions') return { select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) };
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

function fakeReviewDecisionsClient(opts?: { driverError?: string; discountError?: string }) {
  return {
    from: (table: string) => {
      if (table === 'driver_profiles') {
        return {
          select: () => ({
            not: () => ({
              order: () => ({
                limit: async () =>
                  opts?.driverError
                    ? { data: null, error: { message: opts.driverError } }
                    : {
                        data: [
                          { user_id: 'd1', verification_status: 'approved', verified_by: 'sup1', verified_at: '2026-09-05T00:00:00Z' },
                          { user_id: 'd2', verification_status: 'rejected', verified_by: 'sup1', verified_at: '2026-09-01T00:00:00Z' },
                        ],
                        error: null,
                      },
              }),
            }),
          }),
        };
      }
      if (table === 'passenger_discounts') {
        return {
          select: () => ({
            not: () => ({
              limit: () => ({
                order: async () =>
                  opts?.discountError
                    ? { data: null, error: { message: opts.discountError } }
                    : {
                        data: [
                          { id: 'disc1', passenger_id: 'p1', category: 'senior_citizen', status: 'approved', reviewed_by: 'sup1', reviewed_at: '2026-09-08T00:00:00Z' },
                        ],
                        error: null,
                      },
              }),
            }),
          }),
        };
      }
      if (table === 'users') {
        return {
          select: () => ({
            in: async () => ({
              data: [
                { id: 'd1', full_name: 'Ferdinand Amaro' },
                { id: 'd2', full_name: 'Reynaldo Suson' },
                { id: 'p1', full_name: 'Maria Fe Santos' },
                { id: 'sup1', full_name: 'Engr. Wilhelmina Nazareno' },
              ],
              error: null,
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any;
}

test('listReviewDecisions merges driver-verification and discount decisions, newest first, with names resolved', async () => {
  __setSupabaseClientForTests(fakeReviewDecisionsClient());

  const { data, error } = await listReviewDecisions();

  assert.equal(error, null);
  assert.deepEqual(data, [
    {
      id: 'discount:disc1',
      type: 'discount',
      subjectName: 'Maria Fe Santos',
      status: 'approved',
      detail: 'senior_citizen',
      reviewedBy: 'sup1',
      reviewedByName: 'Engr. Wilhelmina Nazareno',
      reviewedAt: '2026-09-08T00:00:00Z',
    },
    {
      id: 'driver:d1',
      type: 'driver_verification',
      subjectName: 'Ferdinand Amaro',
      status: 'approved',
      detail: null,
      reviewedBy: 'sup1',
      reviewedByName: 'Engr. Wilhelmina Nazareno',
      reviewedAt: '2026-09-05T00:00:00Z',
    },
    {
      id: 'driver:d2',
      type: 'driver_verification',
      subjectName: 'Reynaldo Suson',
      status: 'rejected',
      detail: null,
      reviewedBy: 'sup1',
      reviewedByName: 'Engr. Wilhelmina Nazareno',
      reviewedAt: '2026-09-01T00:00:00Z',
    },
  ]);
});

test('listReviewDecisions returns { data: [], error } when the driver_profiles query fails', async () => {
  __setSupabaseClientForTests(fakeReviewDecisionsClient({ driverError: 'connection refused' }));

  const { data, error } = await listReviewDecisions();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('listReviewDecisions returns { data: [], error } when the passenger_discounts query fails', async () => {
  __setSupabaseClientForTests(fakeReviewDecisionsClient({ discountError: 'connection refused' }));

  const { data, error } = await listReviewDecisions();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});
