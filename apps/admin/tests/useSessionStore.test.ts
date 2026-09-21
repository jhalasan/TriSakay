import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '@trisakay/services';

interface FakeConfig {
  signInError?: string;
  /** P1-10: verifyCurrentPassword() re-calls signInWithPassword after the initial signIn() already succeeded — this governs only that later call. */
  reauthSignInError?: string;
  session?: { user: { id: string } } | null;
  userRow?: Record<string, unknown> | null;
  /** Captures the callback useSessionStore registers, so a test can fire a simulated auth event directly. */
  captureAuthStateCallback?: (cb: (session: unknown) => void) => void;
  onSignOut?: () => void;
  updateUserError?: string;
  onUpdateUser?: (attrs: Record<string, unknown>) => void;
  onUsersUpdate?: (attrs: Record<string, unknown>) => void;
}

function fakeClient(config: FakeConfig) {
  const usersQuery = {
    select: () => usersQuery,
    eq: () => usersQuery,
    single: async () =>
      config.userRow ? { data: config.userRow, error: null } : { data: null, error: { message: 'not found' } },
    update: (attrs: Record<string, unknown>) => {
      config.onUsersUpdate?.(attrs);
      return usersQuery;
    },
  };

  let signInCalls = 0;

  return {
    auth: {
      signInWithPassword: async () => {
        signInCalls += 1;
        const errorForThisCall = signInCalls === 1 ? config.signInError : (config.reauthSignInError ?? config.signInError);
        return errorForThisCall
          ? { data: { session: null }, error: { message: errorForThisCall } }
          : { data: { session: config.session ?? null }, error: null };
      },
      getSession: async () => ({ data: { session: config.session ?? null } }),
      signOut: async () => {
        config.onSignOut?.();
      },
      updateUser: async (attrs: Record<string, unknown>) => {
        config.onUpdateUser?.(attrs);
        return config.updateUserError ? { error: { message: config.updateUserError } } : { error: null };
      },
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        config.captureAuthStateCallback?.((session) => cb('SIGNED_IN', session));
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
    from: () => usersQuery,
  } as any;
}

// useSessionStore calls getSupabaseClient() as soon as its module body runs
// (session-restore on load) — a fake client has to exist *before* that
// import happens, or it throws before any test gets to configure one.
let capturedAuthStateCallback: ((session: unknown) => void) | null = null;
__setSupabaseClientForTests(
  fakeClient({ session: null, captureAuthStateCallback: (cb) => (capturedAuthStateCallback = cb) })
);
const { useSessionStore } = await import('../src/store/useSessionStore.ts');

const PSO_ROW = { id: 'u1', first_name: 'Engr. Wilhelmina', last_name: 'Nazareno', full_name: 'Engr. Wilhelmina Nazareno', email: 'w.nazareno@pso.gensantos.gov.ph', role: 'pso_supervisor', avatar_url: null, must_change_password: false };
const DRIVER_ROW = { id: 'u2', first_name: 'Juan', last_name: 'Dela Cruz', full_name: 'Juan Dela Cruz', email: 'juan@example.com', role: 'driver', avatar_url: null, must_change_password: false };

test('signIn() with a PSO account authenticates and populates user', async () => {
  __setSupabaseClientForTests(fakeClient({ session: { user: { id: 'u1' } }, userRow: PSO_ROW }));

  const ok = await useSessionStore.getState().signIn('w.nazareno@pso.gensantos.gov.ph', 'pw');
  assert.equal(ok, true);
  assert.equal(useSessionStore.getState().isAuthenticated, true);
  assert.equal(useSessionStore.getState().user?.role, 'pso_supervisor');
  assert.equal(useSessionStore.getState().error, null);
});

test('signIn() with a non-PSO account (driver/passenger) is rejected, not just hidden', async () => {
  __setSupabaseClientForTests(fakeClient({ session: { user: { id: 'u2' } }, userRow: DRIVER_ROW }));

  const ok = await useSessionStore.getState().signIn('juan@example.com', 'pw');
  assert.equal(ok, false);
  assert.equal(useSessionStore.getState().isAuthenticated, false);
  assert.equal(useSessionStore.getState().user, null);
  assert.match(useSessionStore.getState().error ?? '', /not authorized/);
});

test('signIn() surfaces a bad-credentials error without authenticating', async () => {
  __setSupabaseClientForTests(fakeClient({ signInError: 'Invalid login credentials' }));

  const ok = await useSessionStore.getState().signIn('nobody@example.com', 'wrong');
  assert.equal(ok, false);
  assert.equal(useSessionStore.getState().isAuthenticated, false);
  assert.equal(useSessionStore.getState().error, 'Invalid login credentials');
});

test('signOut() clears the session', async () => {
  __setSupabaseClientForTests(fakeClient({ session: { user: { id: 'u1' } }, userRow: PSO_ROW }));
  await useSessionStore.getState().signIn('w.nazareno@pso.gensantos.gov.ph', 'pw');
  assert.equal(useSessionStore.getState().isAuthenticated, true);

  await useSessionStore.getState().signOut();
  assert.equal(useSessionStore.getState().isAuthenticated, false);
  assert.equal(useSessionStore.getState().user, null);
});

test('the onAuthStateChange listener alone hydrates the session on load (no separate getSession() call)', async () => {
  __setSupabaseClientForTests(fakeClient({ session: { user: { id: 'u1' } }, userRow: PSO_ROW }));
  useSessionStore.setState({ user: null, isAuthenticated: false, isHydrating: true, error: null });

  assert.ok(capturedAuthStateCallback, 'useSessionStore must register an onAuthStateChange callback on import');
  capturedAuthStateCallback!({ user: { id: 'u1' } });

  // hydrateFromSession's profile fetch is async — wait a tick for it to settle.
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(useSessionStore.getState().isHydrating, false);
  assert.equal(useSessionStore.getState().isAuthenticated, true);
  assert.equal(useSessionStore.getState().user?.role, 'pso_supervisor');
});

test('hydration signs the Supabase session back out when it belongs to a non-admin account, same as signIn() does', async () => {
  let signOutCalled = false;
  __setSupabaseClientForTests(
    fakeClient({
      session: { user: { id: 'u2' } },
      userRow: DRIVER_ROW,
      onSignOut: () => {
        signOutCalled = true;
      },
    })
  );
  useSessionStore.setState({ user: null, isAuthenticated: false, isHydrating: true, error: null });

  capturedAuthStateCallback!({ user: { id: 'u2' } });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(signOutCalled, true, 'a session hydration rejects must not be left alive in Supabase storage');
  assert.equal(useSessionStore.getState().isAuthenticated, false);
  assert.equal(useSessionStore.getState().user, null);
  assert.equal(useSessionStore.getState().isHydrating, false);
});

test('signIn() surfaces must_change_password from the profile row', async () => {
  __setSupabaseClientForTests(
    fakeClient({ session: { user: { id: 'u1' } }, userRow: { ...PSO_ROW, must_change_password: true } })
  );

  const ok = await useSessionStore.getState().signIn('w.nazareno@pso.gensantos.gov.ph', 'pw');
  assert.equal(ok, true);
  assert.equal(useSessionStore.getState().user?.mustChangePassword, true);
});

test('completePasswordChange() sets the new password, clears the flag, and updates local state', async () => {
  const updateUserCalls: Record<string, unknown>[] = [];
  const usersUpdateCalls: Record<string, unknown>[] = [];
  __setSupabaseClientForTests(
    fakeClient({
      session: { user: { id: 'u1' } },
      userRow: { ...PSO_ROW, must_change_password: true },
      // A21/A17 reuse check re-signs-in with the CANDIDATE new password first;
      // it must fail (differs from the temp password) for the change to proceed.
      reauthSignInError: 'Invalid login credentials',
      onUpdateUser: (attrs) => updateUserCalls.push(attrs),
      onUsersUpdate: (attrs) => usersUpdateCalls.push(attrs),
    })
  );
  await useSessionStore.getState().signIn('w.nazareno@pso.gensantos.gov.ph', 'pw');
  assert.equal(useSessionStore.getState().user?.mustChangePassword, true);

  const failure = await useSessionStore.getState().completePasswordChange('a-new-strong-password');

  assert.equal(failure, null);
  assert.deepEqual(updateUserCalls, [{ password: 'a-new-strong-password' }]);
  assert.deepEqual(usersUpdateCalls, [{ must_change_password: false }]);
  assert.equal(useSessionStore.getState().user?.mustChangePassword, false);
});

test('completePasswordChange() surfaces an auth error without clearing the flag', async () => {
  __setSupabaseClientForTests(
    fakeClient({
      session: { user: { id: 'u1' } },
      userRow: { ...PSO_ROW, must_change_password: true },
      reauthSignInError: 'Invalid login credentials',
      updateUserError: 'Password should be at least 6 characters.',
    })
  );
  await useSessionStore.getState().signIn('w.nazareno@pso.gensantos.gov.ph', 'pw');

  const failure = await useSessionStore.getState().completePasswordChange('short');

  assert.equal(failure, 'Password should be at least 6 characters.');
  assert.equal(useSessionStore.getState().user?.mustChangePassword, true);
});

test('completePasswordChange() rejects reuse of the temporary password as the new password', async () => {
  const updateUserCalls: Record<string, unknown>[] = [];
  __setSupabaseClientForTests(
    fakeClient({
      session: { user: { id: 'u1' } },
      userRow: { ...PSO_ROW, must_change_password: true },
      // No reauthSignInError set: re-signing-in with the "new" password
      // succeeds, meaning it's identical to the still-active temp password.
      onUpdateUser: (attrs) => updateUserCalls.push(attrs),
    })
  );
  await useSessionStore.getState().signIn('w.nazareno@pso.gensantos.gov.ph', 'pw');

  const failure = await useSessionStore.getState().completePasswordChange('the-temp-password');

  assert.equal(failure, 'Your new password cannot be the same as your temporary password.');
  assert.deepEqual(updateUserCalls, []);
  assert.equal(useSessionStore.getState().user?.mustChangePassword, true);
});

test('changeOwnPassword() re-verifies the current password before updating', async () => {
  const updateUserCalls: Record<string, unknown>[] = [];
  __setSupabaseClientForTests(
    fakeClient({
      session: { user: { id: 'u1' } },
      userRow: PSO_ROW,
      onUpdateUser: (attrs) => updateUserCalls.push(attrs),
    })
  );
  await useSessionStore.getState().signIn('w.nazareno@pso.gensantos.gov.ph', 'old-pw');

  const failure = await useSessionStore.getState().changeOwnPassword('old-pw', 'a-new-strong-password');

  assert.equal(failure, null);
  assert.deepEqual(updateUserCalls, [{ password: 'a-new-strong-password' }]);
});

test('changeOwnPassword() rejects a wrong current password without ever calling updateUser', async () => {
  const updateUserCalls: Record<string, unknown>[] = [];
  __setSupabaseClientForTests(
    fakeClient({
      session: { user: { id: 'u1' } },
      userRow: PSO_ROW,
      reauthSignInError: 'Invalid login credentials',
      onUpdateUser: (attrs) => updateUserCalls.push(attrs),
    })
  );
  await useSessionStore.getState().signIn('w.nazareno@pso.gensantos.gov.ph', 'old-pw');

  const failure = await useSessionStore.getState().changeOwnPassword('wrong-pw', 'a-new-strong-password');

  assert.equal(failure, 'Current password is incorrect.');
  assert.deepEqual(updateUserCalls, []);
});

test('updateName() renames the account and updates local state', async () => {
  const usersUpdateCalls: Record<string, unknown>[] = [];
  __setSupabaseClientForTests(
    fakeClient({
      session: { user: { id: 'u1' } },
      userRow: PSO_ROW,
      onUsersUpdate: (attrs) => usersUpdateCalls.push(attrs),
    })
  );
  await useSessionStore.getState().signIn('w.nazareno@pso.gensantos.gov.ph', 'pw');

  const failure = await useSessionStore.getState().updateName('  New  ', '  Name  ');

  assert.equal(failure, null);
  assert.deepEqual(usersUpdateCalls, [{ first_name: 'New', last_name: 'Name' }]);
  assert.equal(useSessionStore.getState().user?.fullName, 'New Name');
});

test('updateName() rejects a blank first or last name without calling the service', async () => {
  const usersUpdateCalls: Record<string, unknown>[] = [];
  __setSupabaseClientForTests(
    fakeClient({
      session: { user: { id: 'u1' } },
      userRow: PSO_ROW,
      onUsersUpdate: (attrs) => usersUpdateCalls.push(attrs),
    })
  );
  await useSessionStore.getState().signIn('w.nazareno@pso.gensantos.gov.ph', 'pw');

  const failure = await useSessionStore.getState().updateName('   ', 'Nazareno');

  assert.match(failure ?? '', /required/);
  assert.deepEqual(usersUpdateCalls, []);
  assert.equal(useSessionStore.getState().user?.fullName, PSO_ROW.full_name);
});
