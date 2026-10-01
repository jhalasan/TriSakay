import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import {
  confirmMfaEnrollment,
  disableMfa,
  getDeactivationOrigin,
  getMfaGate,
  getMfaStatus,
  listMySessions,
  reactivateOwnAccount,
  revokeMySession,
  startMfaEnrollment,
  verifyMfaCode,
} from '../src/account/index.ts';

test('getMfaStatus: no factor means not enrolled and no challenge', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient());
  assert.deepEqual(await getMfaStatus(), { enrolled: false, factorId: null, needsChallenge: false });
});

test('getMfaStatus: a verified factor at aal1 needs a challenge', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      mfa: {
        listFactors: async () => ({ data: { totp: [{ id: 'f1', status: 'verified' }] }, error: null }),
        getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null }),
      },
    })
  );
  assert.deepEqual(await getMfaStatus(), { enrolled: true, factorId: 'f1', needsChallenge: true });
});

test('getMfaStatus: a verified factor at aal2 needs no challenge', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      mfa: {
        listFactors: async () => ({ data: { totp: [{ id: 'f1', status: 'verified' }] }, error: null }),
        getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null }),
      },
    })
  );
  assert.deepEqual(await getMfaStatus(), { enrolled: true, factorId: 'f1', needsChallenge: false });
});

test('getMfaStatus: an unverified factor does not count as enrolled', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      mfa: { listFactors: async () => ({ data: { totp: [{ id: 'f1', status: 'unverified' }] }, error: null }) },
    })
  );
  assert.equal((await getMfaStatus()).enrolled, false);
});

test('startMfaEnrollment returns the secret, uri and qr code, and surfaces errors', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      mfa: {
        enroll: async () => ({
          data: { id: 'f9', totp: { secret: 'ABCD', uri: 'otpauth://totp/x', qr_code: 'data:image/svg+xml;utf8,<svg/>' } },
          error: null,
        }),
      },
    })
  );
  assert.deepEqual(await startMfaEnrollment(), {
    factorId: 'f9',
    secret: 'ABCD',
    uri: 'otpauth://totp/x',
    qrCode: 'data:image/svg+xml;utf8,<svg/>',
    error: null,
  });

  __setSupabaseClientForTests(createFakeSupabaseClient({ mfa: { enroll: async () => ({ data: null, error: { message: 'MFA disabled' } }) } }));
  assert.equal((await startMfaEnrollment()).error, 'MFA disabled');
});

test('startMfaEnrollment first removes an abandoned unverified factor', async () => {
  const unenrolled: unknown[] = [];
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      mfa: {
        listFactors: async () => ({ data: { totp: [], all: [{ id: 'stale', status: 'unverified', factor_type: 'totp' }] }, error: null }),
        unenroll: async (args) => (unenrolled.push(args), { data: {}, error: null }),
        enroll: async () => ({ data: { id: 'f2', totp: { secret: 'S', uri: 'u', qr_code: 'q' } }, error: null }),
      },
    })
  );
  assert.equal((await startMfaEnrollment()).factorId, 'f2');
  assert.deepEqual(unenrolled, [{ factorId: 'stale' }]);
});

test('verifyMfaCode challenges then verifies with the challenge id', async () => {
  let verifyArgs: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      mfa: {
        challenge: async () => ({ data: { id: 'ch1' }, error: null }),
        verify: async (args) => {
          verifyArgs = args;
          return { data: {}, error: null };
        },
      },
    })
  );
  assert.deepEqual(await verifyMfaCode('f1', '123456'), { error: null });
  assert.deepEqual(verifyArgs, { factorId: 'f1', challengeId: 'ch1', code: '123456' });
});

test('verifyMfaCode reports a wrong code and confirmMfaEnrollment shares the same path', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient({ mfa: { verify: async () => ({ data: null, error: { message: 'Invalid TOTP code' } }) } }));
  assert.equal((await verifyMfaCode('f1', '000000')).error, 'Invalid TOTP code');
  assert.equal((await confirmMfaEnrollment('f1', '000000')).error, 'Invalid TOTP code');
});

test('disableMfa unenrolls the factor', async () => {
  let args: any = null;
  __setSupabaseClientForTests(createFakeSupabaseClient({ mfa: { unenroll: async (a) => ((args = a), { data: {}, error: null }) } }));
  assert.deepEqual(await disableMfa('f1'), { error: null });
  assert.deepEqual(args, { factorId: 'f1' });
});

test('listMySessions maps rows and flags the current device', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn) => {
        assert.equal(fn, 'list_my_sessions');
        return {
          data: [{ id: 's1', created_at: 'a', updated_at: 'b', user_agent: 'okhttp', is_current: true }],
          error: null,
        };
      },
    })
  );
  assert.deepEqual(await listMySessions(), {
    sessions: [{ id: 's1', createdAt: 'a', updatedAt: 'b', userAgent: 'okhttp', isCurrent: true }],
    error: null,
  });
});

test('revokeMySession, reactivateOwnAccount and getDeactivationOrigin call their RPCs', async () => {
  const calls: Array<[string, unknown]> = [];
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn, args) => {
        calls.push([fn, args]);
        return { data: fn === 'my_deactivation_origin' ? 'self' : null, error: null };
      },
    })
  );
  assert.deepEqual(await revokeMySession('s2'), { error: null });
  assert.deepEqual(await reactivateOwnAccount(), { error: null });
  assert.equal(await getDeactivationOrigin(), 'self');
  assert.deepEqual(calls, [
    ['revoke_my_session', { p_session_id: 's2' }],
    ['self_reactivate_account', undefined],
    ['my_deactivation_origin', undefined],
  ]);
});

test('getMfaGate: challenge only when the session is at aal1 and a verified factor needs aal2', async () => {
  const levels = (currentLevel: string, nextLevel: string) =>
    createFakeSupabaseClient({ mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel, nextLevel }, error: null }) } });

  __setSupabaseClientForTests(levels('aal1', 'aal2'));
  assert.equal(await getMfaGate(), 'challenge');
  __setSupabaseClientForTests(levels('aal2', 'aal2'));
  assert.equal(await getMfaGate(), 'ok');
  __setSupabaseClientForTests(levels('aal1', 'aal1'));
  assert.equal(await getMfaGate(), 'ok');
});

test('getMfaGate does not block when the level cannot be read', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: null, error: { message: 'offline' } }) } })
  );
  assert.equal(await getMfaGate(), 'ok');
});
