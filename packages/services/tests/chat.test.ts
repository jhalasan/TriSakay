import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import { listMessages, markMessagesRead, sendQuickReply, sendTextMessage } from '../src/chat/index.ts';

const FAKE_ROW = {
  id: 'm1',
  ride_request_id: 'rr1',
  sender_id: 'u1',
  kind: 'text',
  body: 'hi there',
  image_path: null,
  contains_masked_phone: false,
  created_at: '2026-09-29T10:00:00Z',
  read_at: null,
};

test('listMessages maps rows to camelCase, oldest first', async () => {
  let capturedOrder: [string, { ascending: boolean }] | null = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: (table) => {
        assert.equal(table, 'ride_messages');
        return {
          select: () => ({
            eq: (column: string, value: unknown) => {
              assert.equal(column, 'ride_request_id');
              assert.equal(value, 'rr1');
              return {
                order: (column: string, opts: { ascending: boolean }) => {
                  capturedOrder = [column, opts];
                  return Promise.resolve({ data: [FAKE_ROW], error: null });
                },
              };
            },
          }),
        };
      },
    })
  );

  const { data, error } = await listMessages('rr1');

  assert.equal(error, null);
  assert.deepEqual(capturedOrder, ['created_at', { ascending: true }]);
  assert.deepEqual(data, [
    {
      id: 'm1',
      rideRequestId: 'rr1',
      senderId: 'u1',
      kind: 'text',
      body: 'hi there',
      imagePath: null,
      containsMaskedPhone: false,
      createdAt: '2026-09-29T10:00:00Z',
      readAt: null,
    },
  ]);
});

test('listMessages returns an empty array and the error message on query failure', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
          }),
        }),
      }),
    })
  );

  const { data, error } = await listMessages('rr1');
  assert.deepEqual(data, []);
  assert.equal(error, 'boom');
});

test('sendTextMessage trims and length-caps the body before inserting', async () => {
  let capturedInsert: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
      from: (table) => {
        assert.equal(table, 'ride_messages');
        return {
          insert: (row: unknown) => {
            capturedInsert = row;
            return { select: () => ({ single: async () => ({ data: { ...FAKE_ROW, ...(row as object) }, error: null }) }) };
          },
        };
      },
    })
  );

  const { data, error } = await sendTextMessage('rr1', '  hello driver  ');

  assert.equal(error, null);
  assert.equal(data?.body, 'hello driver');
  assert.deepEqual(capturedInsert, { ride_request_id: 'rr1', sender_id: 'u1', kind: 'text', body: 'hello driver' });
});

test('sendTextMessage rejects a message that is empty after trimming, without hitting the network', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
      from: () => {
        throw new Error('should not be called for an empty message');
      },
    })
  );

  const { data, error } = await sendTextMessage('rr1', '   ');
  assert.equal(data, null);
  assert.equal(error, 'Message is empty');
});

test('sendTextMessage returns an error when there is no active session', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient({ getSession: async () => ({ data: { session: null } }) }));

  const { data, error } = await sendTextMessage('rr1', 'hello');
  assert.equal(data, null);
  assert.equal(error, 'Not signed in');
});

test('sendTextMessage surfaces the rate-limit/mask trigger error from the server', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
      from: () => ({
        insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: "You're sending messages too quickly. Please wait a moment." } }) }) }),
      }),
    })
  );

  const { data, error } = await sendTextMessage('rr1', 'hello');
  assert.equal(data, null);
  assert.equal(error, "You're sending messages too quickly. Please wait a moment.");
});

test('sendQuickReply inserts the fixed code as the body, not free text', async () => {
  let capturedInsert: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
      from: () => ({
        insert: (row: unknown) => {
          capturedInsert = row;
          return { select: () => ({ single: async () => ({ data: { ...FAKE_ROW, ...(row as object), kind: 'quick_reply' }, error: null }) }) };
        },
      }),
    })
  );

  const { data, error } = await sendQuickReply('rr1', 'im_here');

  assert.equal(error, null);
  assert.equal(data?.kind, 'quick_reply');
  assert.deepEqual(capturedInsert, { ride_request_id: 'rr1', sender_id: 'u1', kind: 'quick_reply', body: 'im_here' });
});

test('markMessagesRead scopes the update to this ride and only unread rows', async () => {
  let capturedUpdate: any = null;
  let capturedEq: [string, unknown] | null = null;
  let capturedIs: [string, unknown] | null = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: () => ({
        update: (row: unknown) => {
          capturedUpdate = row;
          return {
            eq: (column: string, value: unknown) => {
              capturedEq = [column, value];
              return {
                is: (column: string, value: unknown) => {
                  capturedIs = [column, value];
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        },
      }),
    })
  );

  const { error } = await markMessagesRead('rr1');

  assert.equal(error, null);
  assert.equal(typeof (capturedUpdate as any).read_at, 'string');
  assert.deepEqual(capturedEq, ['ride_request_id', 'rr1']);
  assert.deepEqual(capturedIs, ['read_at', null]);
});

test('markMessagesRead surfaces the error message on update failure', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      from: () => ({
        update: () => ({ eq: () => ({ is: () => Promise.resolve({ error: { message: 'boom' } }) }) }),
      }),
    })
  );

  const { error } = await markMessagesRead('rr1');
  assert.equal(error, 'boom');
});
