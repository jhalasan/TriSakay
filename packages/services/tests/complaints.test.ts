import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/supabase/database.types.ts';
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
          insert: (row: unknown) => {
            capturedInsert = row;
            return { select: () => ({ single: async () => ({ data: { id: 'c1' }, error: null }) }) };
          },
        };
      },
    })
  );

  const { error, attachmentError } = await submitComplaint({
    subject: 'Overcharged',
    message: 'Driver asked for more than the fare.',
  });

  assert.equal(error, null);
  assert.equal(attachmentError, null);
  assert.deepEqual(capturedInsert, {
    submitted_by: 'u1',
    subject: 'Overcharged',
    message: 'Driver asked for more than the fare.',
  });
});

test('submitComplaint includes category and ride_request_id when provided', async () => {
  let capturedInsert: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: () => ({
        insert: (row: unknown) => {
          capturedInsert = row;
          return { select: () => ({ single: async () => ({ data: { id: 'c1' }, error: null }) }) };
        },
      }),
    })
  );

  const { error } = await submitComplaint({
    subject: 'Overcharged',
    message: 'Driver asked for more than the fare.',
    category: 'fare',
    rideRequestId: 'ride-1',
  });

  assert.equal(error, null);
  assert.deepEqual(capturedInsert, {
    submitted_by: 'u1',
    subject: 'Overcharged',
    message: 'Driver asked for more than the fare.',
    category: 'fare',
    ride_request_id: 'ride-1',
  });
});

test('submitComplaint returns an error when there is no active session', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient({ getSession: async () => ({ data: { session: null } }) }));

  const { error, attachmentError } = await submitComplaint({ subject: 'x', message: 'y' });
  assert.equal(error, 'Not signed in');
  assert.equal(attachmentError, null);
});

test('submitComplaint surfaces a Postgres error on the complaint insert itself', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: () => ({
        insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'network error' } }) }) }),
      }),
    })
  );

  const { error } = await submitComplaint({ subject: 'x', message: 'y' });
  assert.equal(error, 'network error');
});

test('submitComplaint uploads attachments after the complaint row exists and records them', async () => {
  const uploadedPaths: string[] = [];
  let capturedAttachmentRows: any = null;

  __setSupabaseClientForTests({
    auth: { getSession: async () => SESSION },
    from: (table: string) => {
      if (table === 'complaints') {
        return {
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'c1' }, error: null }) }) }),
        };
      }
      if (table === 'complaint_attachments') {
        return {
          insert: async (rows: unknown) => {
            capturedAttachmentRows = rows;
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    storage: {
      from: () => ({
        upload: async (path: string) => {
          uploadedPaths.push(path);
          return { error: null };
        },
        remove: async () => ({ error: null }),
      }),
    },
  } as unknown as SupabaseClient<Database>);

  const { error, attachmentError } = await submitComplaint({
    subject: 'Unsafe driving',
    message: 'Driver ran a red light.',
    attachments: [{ data: new ArrayBuffer(0) }, { data: new ArrayBuffer(0) }],
  });

  assert.equal(error, null);
  assert.equal(attachmentError, null);
  assert.equal(uploadedPaths.length, 2);
  assert.ok(uploadedPaths[0].startsWith('c1/0-'));
  assert.ok(uploadedPaths[1].startsWith('c1/1-'));
  assert.deepEqual(capturedAttachmentRows, [
    { complaint_id: 'c1', storage_path: uploadedPaths[0], uploaded_by: 'u1' },
    { complaint_id: 'c1', storage_path: uploadedPaths[1], uploaded_by: 'u1' },
  ]);
});

test('submitComplaint reports attachmentError (not error) when an upload fails, leaving the complaint filed', async () => {
  const removedCalls: string[][] = [];

  __setSupabaseClientForTests({
    auth: { getSession: async () => SESSION },
    from: (table: string) => {
      if (table === 'complaints') {
        return {
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'c1' }, error: null }) }) }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    storage: {
      from: () => ({
        upload: async () => ({ error: { message: 'storage error' } }),
        remove: async (paths: string[]) => {
          removedCalls.push(paths);
          return { error: null };
        },
      }),
    },
  } as unknown as SupabaseClient<Database>);

  const { error, attachmentError } = await submitComplaint({
    subject: 'Unsafe driving',
    message: 'Driver ran a red light.',
    attachments: [{ data: new ArrayBuffer(0) }],
  });

  assert.equal(error, null);
  assert.equal(attachmentError, 'storage error');
});

test('submitComplaint reports attachmentError and rolls back storage when the complaint_attachments insert fails', async () => {
  const removedCalls: string[][] = [];

  __setSupabaseClientForTests({
    auth: { getSession: async () => SESSION },
    from: (table: string) => {
      if (table === 'complaints') {
        return {
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'c1' }, error: null }) }) }),
        };
      }
      if (table === 'complaint_attachments') {
        return { insert: async () => ({ error: { message: 'insert failed' } }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
    storage: {
      from: () => ({
        upload: async (path: string) => ({ error: null, path }),
        remove: async (paths: string[]) => {
          removedCalls.push(paths);
          return { error: null };
        },
      }),
    },
  } as unknown as SupabaseClient<Database>);

  const { error, attachmentError } = await submitComplaint({
    subject: 'Unsafe driving',
    message: 'Driver ran a red light.',
    attachments: [{ data: new ArrayBuffer(0) }],
  });

  assert.equal(error, null);
  assert.equal(attachmentError, 'insert failed');
  assert.equal(removedCalls.length, 1);
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
