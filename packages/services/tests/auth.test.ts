import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import {
  getCurrentUserProfile,
  onAuthStateChange,
  requestPasswordReset,
  signIn,
  signOut,
  signUp,
  updatePassword,
  updateProfile,
  verifyPasswordReset,
} from '../src/auth/index.ts';

test('signUp sends full name, phone, and default role as signup metadata', async () => {
  let capturedArgs: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      signUp: async (args) => {
        capturedArgs = args;
        return { data: { session: null }, error: null };
      },
    })
  );

  await signUp({
    fullName: 'Juan Dela Cruz',
    email: 'juan@example.com',
    phone: '09171234567',
    password: 'secret1',
  });

  assert.equal(capturedArgs.email, 'juan@example.com');
  assert.equal(capturedArgs.password, 'secret1');
  assert.deepEqual(capturedArgs.options.data, {
    full_name: 'Juan Dela Cruz',
    phone: '09171234567',
    role: 'passenger',
  });
});

test('signUp defaults role to passenger when omitted', async () => {
  let capturedArgs: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      signUp: async (args) => {
        capturedArgs = args;
        return { data: { session: null }, error: null };
      },
    })
  );

  await signUp({ fullName: 'Juan', email: 'juan@example.com', phone: '0900', password: 'secret1' });

  assert.equal(capturedArgs.options.data.role, 'passenger');
});

test('signUp passes role through when provided', async () => {
  let capturedArgs: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      signUp: async (args) => {
        capturedArgs = args;
        return { data: { session: null }, error: null };
      },
    })
  );

  await signUp({ fullName: 'Ana', email: 'ana@example.com', phone: '0911', password: 'secret1', role: 'driver' });

  assert.equal(capturedArgs.options.data.role, 'driver');
});

test('signUp returns the error message when Supabase rejects the signup', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      signUp: async () => ({ data: { session: null }, error: { message: 'Email already registered' } }),
    })
  );

  const result = await signUp({ fullName: 'A', email: 'dup@example.com', phone: '0917', password: 'secret1' });
  assert.equal(result.error, 'Email already registered');
  assert.equal(result.session, null);
});

test('signIn returns a session on success', async () => {
  const fakeSession = { access_token: 'abc', user: { id: 'u1' } };
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      signInWithPassword: async () => ({ data: { session: fakeSession }, error: null }),
    })
  );

  const result = await signIn({ email: 'juan@example.com', password: 'secret1' });
  assert.deepEqual(result.session, fakeSession);
  assert.equal(result.error, null);
});

test('signOut calls the underlying auth.signOut with local scope, not global', async () => {
  let capturedArgs: unknown;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      signOut: async (args?: unknown) => {
        capturedArgs = args;
      },
    })
  );
  await signOut();
  assert.deepEqual(capturedArgs, { scope: 'local' });
});

test('getCurrentUserProfile returns null when there is no active session', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient({ getSession: async () => ({ data: { session: null } }) }));
  const profile = await getCurrentUserProfile();
  assert.equal(profile, null);
});

test('getCurrentUserProfile returns the public.users row for the active session', async () => {
  const fakeSession = { user: { id: 'u1' } };
  const userRow = {
    id: 'u1',
    full_name: 'Juan',
    email: 'juan@example.com',
    contact_no: '0917',
    role: 'passenger',
  };
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => ({ data: { session: fakeSession } }),
      userRow,
    })
  );
  const profile = await getCurrentUserProfile();
  assert.deepEqual(profile, userRow);
});

test('updateProfile updates full_name and reports no error on success', async () => {
  const fakeSession = { user: { id: 'u1' } };
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ getSession: async () => ({ data: { session: fakeSession } }), updateError: null })
  );
  const result = await updateProfile({ fullName: 'New Name' });
  assert.equal(result.error, null);
});

test('updateProfile returns an error when there is no active session', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient({ getSession: async () => ({ data: { session: null } }) }));
  const result = await updateProfile({ fullName: 'New Name' });
  assert.equal(result.error, 'Not signed in');
});

test('requestPasswordReset sends the email to Supabase and reports no error on success', async () => {
  let capturedEmail: string | null = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      resetPasswordForEmail: async (email) => {
        capturedEmail = email;
        return { data: {}, error: null };
      },
    })
  );

  const result = await requestPasswordReset('juan@example.com');
  assert.equal(capturedEmail, 'juan@example.com');
  assert.equal(result.error, null);
});

test('requestPasswordReset returns the error message when Supabase rejects the request', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      resetPasswordForEmail: async () => ({ data: {}, error: { message: 'Rate limit exceeded' } }),
    })
  );

  const result = await requestPasswordReset('juan@example.com');
  assert.equal(result.error, 'Rate limit exceeded');
});

test('verifyPasswordReset sends the email/token pair as a recovery OTP and returns the session', async () => {
  let capturedArgs: any = null;
  const fakeSession = { access_token: 'recovery-token', user: { id: 'u1' } };
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      verifyOtp: async (args) => {
        capturedArgs = args;
        return { data: { session: fakeSession }, error: null };
      },
    })
  );

  const result = await verifyPasswordReset({ email: 'juan@example.com', token: '123456' });
  assert.deepEqual(capturedArgs, { email: 'juan@example.com', token: '123456', type: 'recovery' });
  assert.deepEqual(result.session, fakeSession);
  assert.equal(result.error, null);
});

test('verifyPasswordReset returns the error message for an invalid or expired code', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      verifyOtp: async () => ({ data: { session: null }, error: { message: 'Token has expired or is invalid' } }),
    })
  );

  const result = await verifyPasswordReset({ email: 'juan@example.com', token: '000000' });
  assert.equal(result.error, 'Token has expired or is invalid');
  assert.equal(result.session, null);
});

test('updatePassword sends the new password to Supabase and reports no error on success', async () => {
  let capturedArgs: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      updateUser: async (args) => {
        capturedArgs = args;
        return { data: {}, error: null };
      },
    })
  );

  const result = await updatePassword('newSecret1');
  assert.deepEqual(capturedArgs, { password: 'newSecret1' });
  assert.equal(result.error, null);
});

test('updatePassword returns the error message on failure', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      updateUser: async () => ({ data: {}, error: { message: 'Password too weak' } }),
    })
  );

  const result = await updatePassword('123');
  assert.equal(result.error, 'Password too weak');
});

test('onAuthStateChange forwards session changes and returns an unsubscribe function', () => {
  let receivedSession: unknown = 'not-called';
  let unsubscribed = false;
  __setSupabaseClientForTests({
    auth: {
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        cb('SIGNED_IN', { access_token: 'xyz' });
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                unsubscribed = true;
              },
            },
          },
        };
      },
    },
  } as any);

  const unsubscribe = onAuthStateChange((session) => {
    receivedSession = session;
  });
  assert.deepEqual(receivedSession, { access_token: 'xyz' });
  unsubscribe();
  assert.equal(unsubscribed, true);
});
