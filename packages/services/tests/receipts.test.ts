import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import { emailTripReceipt, getEmailReceiptsConsent, setEmailReceiptsConsent } from '../src/receipts/index.ts';

const SESSION = { data: { session: { user: { id: 'p1' } } } };

test('emailTripReceipt invokes send-receipt with only the ride id', async () => {
  let captured: { name: string; options: unknown } | null = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      functionsInvoke: async (name, options) => {
        captured = { name, options };
        return { data: { sent: true }, error: null };
      },
    }),
  );

  assert.deepEqual(await emailTripReceipt('rr1'), { error: null });
  assert.deepEqual(captured, { name: 'send-receipt', options: { body: { rideRequestId: 'rr1' } } });
});

test('emailTripReceipt surfaces the function\'s own message on a non-2xx response', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      functionsInvoke: async () => ({
        data: null,
        error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({ error: 'Daily receipt email limit reached. Please try again tomorrow' }) } },
      }),
    }),
  );

  assert.deepEqual(await emailTripReceipt('rr1'), { error: 'Daily receipt email limit reached. Please try again tomorrow' });
});

test('emailTripReceipt treats a skipped send (nothing to do) as success', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ functionsInvoke: async () => ({ data: { sent: false, skipped: 'already sent' }, error: null }) }),
  );
  assert.deepEqual(await emailTripReceipt('rr1'), { error: null });
});

test('getEmailReceiptsConsent reads the signed-in user\'s own flag, defaulting to false', async () => {
  const filters: [string, unknown][] = [];
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: (table) => {
        assert.equal(table, 'users');
        const q: any = {
          select: (cols: string) => {
            assert.equal(cols, 'email_receipts');
            return q;
          },
          eq: (c: string, v: unknown) => {
            filters.push([c, v]);
            return q;
          },
          maybeSingle: async () => ({ data: { email_receipts: true }, error: null }),
        };
        return q;
      },
    }),
  );
  assert.deepEqual(await getEmailReceiptsConsent(), { data: true, error: null });
  assert.deepEqual(filters, [['id', 'p1']]);

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: () => {
        const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: null, error: null }) };
        return q;
      },
    }),
  );
  assert.deepEqual(await getEmailReceiptsConsent(), { data: false, error: null });
});

test('setEmailReceiptsConsent updates only email_receipts on the user\'s own row', async () => {
  let patch: unknown = null;
  const filters: [string, unknown][] = [];
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      from: () => ({
        update: (row: unknown) => {
          patch = row;
          return {
            eq: async (c: string, v: unknown) => {
              filters.push([c, v]);
              return { error: null };
            },
          };
        },
      }),
    }),
  );
  assert.deepEqual(await setEmailReceiptsConsent(true), { error: null });
  assert.deepEqual(patch, { email_receipts: true });
  assert.deepEqual(filters, [['id', 'p1']]);
});

test('setEmailReceiptsConsent fails cleanly when nobody is signed in', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient({ getSession: async () => ({ data: { session: null } }) }));
  assert.deepEqual(await setEmailReceiptsConsent(true), { error: 'Not signed in' });
});
