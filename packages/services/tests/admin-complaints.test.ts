import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { listComplaintsForAdmin, recordDhDirectiveForAdmin, setComplaintStatusForAdmin } from '../src/admin/complaints.ts';

const SESSION = { session: { user: { id: 'staff1' } } };

function fakeClient() {
  const complaints = [
    {
      id: 'cmp1',
      submitted_by: 'p1',
      against_user_id: 'd1',
      category: 'fare',
      subject: 'Driver refused agreed fare',
      status: 'open',
      dh_directive: null as string | null,
      created_at: '2026-08-01T00:00:00.000Z',
    },
  ];
  const users = [
    { id: 'p1', full_name: 'Maria Fe Santos' },
    { id: 'd1', full_name: 'Ferdinand Amaro' },
  ];

  return {
    from: (table: string) => {
      if (table === 'complaints') {
        return {
          select: () => ({ order: async () => ({ data: complaints, error: null }) }),
          update: (patch: Record<string, unknown>) => ({
            eq: async (_col: string, id: string) => {
              const c = complaints.find((row) => row.id === id);
              if (c) Object.assign(c, patch);
              return { error: null };
            },
          }),
        };
      }
      if (table === 'users') {
        return { select: () => ({ in: async () => ({ data: users, error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
    auth: { getSession: async () => ({ data: SESSION }) },
  } as any;
}

test('listComplaintsForAdmin resolves submitter/accused names and passes category/status/dhDirective through', async () => {
  __setSupabaseClientForTests(fakeClient());

  const { data, error } = await listComplaintsForAdmin();
  assert.equal(error, null);
  assert.deepEqual(data, [
    {
      id: 'cmp1',
      subject: 'Driver refused agreed fare',
      submittedByName: 'Maria Fe Santos',
      againstUserName: 'Ferdinand Amaro',
      category: 'fare',
      status: 'open',
      dhDirective: null,
      createdAt: '2026-08-01T00:00:00.000Z',
    },
  ]);
});

test('listComplaintsForAdmin returns { data: [], error } when the query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ order: async () => ({ data: null, error: { message: 'connection refused' } }) }) }),
  } as any);

  const { data, error } = await listComplaintsForAdmin();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('setComplaintStatusForAdmin stamps triaged_by/triaged_at from the signed-in PSO', async () => {
  __setSupabaseClientForTests(fakeClient());

  const { error } = await setComplaintStatusForAdmin('cmp1', 'under_review');
  assert.equal(error, null);

  const { data } = await listComplaintsForAdmin();
  assert.equal(data[0].status, 'under_review');
});

test('setComplaintStatusForAdmin returns an error when there is no active session', async () => {
  __setSupabaseClientForTests({ auth: { getSession: async () => ({ data: { session: null } }) } } as any);

  const { error } = await setComplaintStatusForAdmin('cmp1', 'under_review');
  assert.equal(error, 'Not signed in');
});

test('recordDhDirectiveForAdmin writes the directive text', async () => {
  __setSupabaseClientForTests(fakeClient());

  const { error } = await recordDhDirectiveForAdmin('cmp1', 'Contact both parties.');
  assert.equal(error, null);

  const { data } = await listComplaintsForAdmin();
  assert.equal(data[0].dhDirective, 'Contact both parties.');
});

test('recordDhDirectiveForAdmin returns an error when there is no active session', async () => {
  __setSupabaseClientForTests({ auth: { getSession: async () => ({ data: { session: null } }) } } as any);

  const { error } = await recordDhDirectiveForAdmin('cmp1', 'Contact both parties.');
  assert.equal(error, 'Not signed in');
});
