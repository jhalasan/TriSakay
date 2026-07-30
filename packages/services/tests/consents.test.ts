import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TOS_VERSION,
  getConsentStatus,
  recordConsent,
} from '../src/consents/index.ts';

const SESSION = { data: { session: { user: { id: 'u1' } } } };

test('getConsentStatus reports bothAccepted when both current versions are on file', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      consentRows: [
        { policy_type: 'terms_of_service', policy_version: CURRENT_TOS_VERSION },
        { policy_type: 'privacy_policy', policy_version: CURRENT_PRIVACY_VERSION },
      ],
    })
  );

  const { status, error } = await getConsentStatus();
  assert.equal(error, null);
  assert.deepEqual(status, { termsAccepted: true, privacyAccepted: true, bothAccepted: true });
});

test('getConsentStatus treats a stale policy version as not accepted', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      consentRows: [
        { policy_type: 'terms_of_service', policy_version: 'v0.9' },
        { policy_type: 'privacy_policy', policy_version: CURRENT_PRIVACY_VERSION },
      ],
    })
  );

  const { status } = await getConsentStatus();
  assert.equal(status?.termsAccepted, false);
  assert.equal(status?.privacyAccepted, true);
  assert.equal(status?.bothAccepted, false);
});

test('getConsentStatus reports nothing accepted when the user has no consent rows', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ getSession: async () => SESSION, consentRows: [] })
  );

  const { status, error } = await getConsentStatus();
  assert.equal(error, null);
  assert.deepEqual(status, { termsAccepted: false, privacyAccepted: false, bothAccepted: false });
});

test('getConsentStatus scopes the query to the signed-in user', async () => {
  const filters: any[] = [];
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      consentRows: [],
      onConsentSelect: (column, value) => {
        filters.push([column, value]);
      },
    })
  );

  await getConsentStatus();
  // RLS is the real control; this is defence in depth. Without it the fake
  // ignores filters entirely and deleting `.eq('user_id', userId)` from
  // getConsentStatus() passes every other test in this file.
  assert.deepEqual(filters, [['user_id', 'u1']]);
});

test('getConsentStatus surfaces a query error instead of reporting a false status', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ getSession: async () => SESSION, consentSelectError: 'network down' })
  );

  const { status, error } = await getConsentStatus();
  assert.equal(status, null);
  assert.equal(error, 'network down');
});

test('getConsentStatus reports an error when there is no active session', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ getSession: async () => ({ data: { session: null } }) })
  );

  const { status, error } = await getConsentStatus();
  assert.equal(status, null);
  assert.equal(error, 'Not signed in');
});

test('recordConsent inserts both policy rows in one call and lets the database set accepted_at', async () => {
  let captured: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      onConsentInsert: (rows) => {
        captured = rows;
      },
    })
  );

  const { error } = await recordConsent();
  assert.equal(error, null);
  assert.equal(captured.length, 2);
  assert.deepEqual(captured, [
    { user_id: 'u1', policy_type: 'terms_of_service', policy_version: CURRENT_TOS_VERSION },
    { user_id: 'u1', policy_type: 'privacy_policy', policy_version: CURRENT_PRIVACY_VERSION },
  ]);
  // accepted_at must come from the column default (the database clock), not the client.
  assert.equal('accepted_at' in captured[0], false);
});

test('recordConsent returns the error message when the insert fails', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ getSession: async () => SESSION, consentInsertError: 'insert failed' })
  );

  const { error } = await recordConsent();
  assert.equal(error, 'insert failed');
});

test('recordConsent returns an error when there is no active session', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ getSession: async () => ({ data: { session: null } }) })
  );

  const { error } = await recordConsent();
  assert.equal(error, 'Not signed in');
});
