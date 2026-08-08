import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '@trisakay/services';

interface FakeConfig {
  signInError?: string;
  session?: { user: { id: string } } | null;
  userRow?: Record<string, unknown> | null;
  /** Captures the callback useSessionStore registers, so a test can fire a simulated auth event directly. */
  captureAuthStateCallback?: (cb: (session: unknown) => void) => void;
}

function fakeClient(config: FakeConfig) {
  const usersQuery = {
    select: () => usersQuery,
    eq: () => usersQuery,
    single: async () =>
      config.userRow ? { data: config.userRow, error: null } : { data: null, error: { message: 'not found' } },
  };

  return {
    auth: {
      signInWithPassword: async () =>
        config.signInError
          ? { data: { session: null }, error: { message: config.signInError } }
          : { data: { session: config.session ?? null }, error: null },
      getSession: async () => ({ data: { session: config.session ?? null } }),
      signOut: async () => {},
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

const PSO_ROW = { id: 'u1', full_name: 'Engr. Wilhelmina Nazareno', email: 'w.nazareno@pso.gensantos.gov.ph', role: 'pso_supervisor', avatar_url: null };
const DRIVER_ROW = { id: 'u2', full_name: 'Juan Dela Cruz', email: 'juan@example.com', role: 'driver', avatar_url: null };

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
