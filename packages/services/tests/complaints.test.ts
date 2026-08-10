import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import { listMyComplaints, submitComplaint } from '../src/complaints/index.ts';

const SESSION = { data: { session: { user: { id: 'u1' } } } };

test('submitComplaint inserts with submitted_by set to the signed-in user', async () => {
  let capturedInsert: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: (table) => {
        assert.equal(table, 'complaints');
        return {
          insert: async (row: unknown) => {
            capturedInsert = row;
            return { error: null };
          },
        };
      },
    })
  );

  const { error } = await submitComplaint({ subject: 'Overcharged', message: 'Driver asked for more than the fare.' });

  assert.equal(error, null);
  assert.deepEqual(capturedInsert, {
    submitted_by: 'u1',
    subject: 'Overcharged',
    message: 'Driver asked for more than the fare.',
  });
});

test('submitComplaint returns an error when there is no active session', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient({ getSession: async () => ({ data: { session: null } }) }));

  const { error } = await submitComplaint({ subject: 'x', message: 'y' });
  assert.equal(error, 'Not signed in');
});

test('submitComplaint surfaces a Postgres error', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: () => ({ insert: async () => ({ error: { message: 'network error' } }) }),
    })
  );

  const { error } = await submitComplaint({ subject: 'x', message: 'y' });
  assert.equal(error, 'network error');
});

test('listMyComplaints scopes to the signed-in user and returns rows newest first', async () => {
  let capturedEqArgs: [string, unknown] | null = null;
  let capturedOrderArgs: [string, unknown] | null = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: (table) => {
        assert.equal(table, 'complaints');
        return {
          select: () => ({
            eq: (column: string, value: unknown) => {
              capturedEqArgs = [column, value];
              return {
                order: (column2: string, opts: unknown) => {
                  capturedOrderArgs = [column2, opts];
                  return Promise.resolve({
                    data: [{ id: 'c1', subject: 'Overcharged', status: 'open' }],
                    error: null,
                  });
                },
              };
            },
          }),
        };
      },
    })
  );

  const { data, error } = await listMyComplaints();

  assert.equal(error, null);
  assert.deepEqual(capturedEqArgs, ['submitted_by', 'u1']);
  assert.deepEqual(capturedOrderArgs, ['created_at', { ascending: false }]);
  assert.deepEqual(data, [{ id: 'c1', subject: 'Overcharged', status: 'open' }]);
});

test('listMyComplaints returns an error when there is no active session', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient({ getSession: async () => ({ data: { session: null } }) }));

  const { data, error } = await listMyComplaints();
  assert.deepEqual(data, []);
  assert.equal(error, 'Not signed in');
});

test('listMyComplaints surfaces a query error with an empty list', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: null, error: { message: 'network error' } }) }) }) }),
    })
  );

  const { data, error } = await listMyComplaints();
  assert.deepEqual(data, []);
  assert.equal(error, 'network error');
});
