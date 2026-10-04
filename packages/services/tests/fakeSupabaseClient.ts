import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/supabase/database.types';

export interface FakeConsentRow {
  policy_type: string;
  policy_version: string;
}

export interface FakeClientConfig {
  signUp?: (args: unknown) => Promise<{ data: { session: unknown }; error: { message: string } | null }>;
  /** Override for `auth.setSession(args)` — used when a sign in goes through the sign-in edge function. */
  setSession?: (args: unknown) => Promise<{ data: { session: unknown }; error: { name?: string; message: string } | null }>;
  signInWithPassword?: (
    args: unknown
  ) => Promise<{ data: { session: unknown }; error: { message: string } | null }>;
  getSession?: () => Promise<{ data: { session: unknown } }>;
  signOut?: (args?: unknown) => Promise<void>;
  resetPasswordForEmail?: (
    email: string,
    options?: unknown
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  verifyOtp?: (args: unknown) => Promise<{ data: { session: unknown }; error: { message: string } | null }>;
  updateUser?: (args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
  userRow?: Record<string, unknown> | null;
  updateError?: string | null;
  /** Receives the object passed to the `users` table's `.update()`, so tests can assert the payload shape. */
  onUsersUpdate?: (row: unknown) => void;
  /** Rows `user_consents` selects resolve to. */
  consentRows?: FakeConsentRow[];
  consentSelectError?: string | null;
  consentInsertError?: string | null;
  /** Receives the array passed to `.insert()`, so tests can assert the payload shape. */
  onConsentInsert?: (rows: unknown) => void;
  /**
   * Receives each `.eq()` applied to the consent query. Without it the fake
   * returns `consentRows` regardless of any filter, so dropping the
   * `user_id` scope from getConsentStatus() would leave every status test
   * green while the query returned other users' rows.
   */
  onConsentSelect?: (column: string, value: unknown) => void;
  /** Full override for `.from(table)` — when set, bypasses the built-in users/consents tables entirely. */
  from?: (table: string) => unknown;
  /** Full override for `.channel(name)` — used by Realtime-subscription tests. */
  channel?: (name: string) => unknown;
  removeChannel?: (channel: unknown) => void;
  /** Override for `.functions.invoke(name, options)` — used by Edge Function callers. */
  functionsInvoke?: (
    name: string,
    options: unknown
  ) => Promise<{ data: unknown; error: { message: string; context?: unknown } | null }>;
  /** Overrides for `auth.mfa.*`. */
  mfa?: {
    listFactors?: () => Promise<{ data: unknown; error: { message: string } | null }>;
    getAuthenticatorAssuranceLevel?: () => Promise<{ data: unknown; error: { message: string } | null }>;
    enroll?: (args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
    challenge?: (args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
    verify?: (args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
    unenroll?: (args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  /** Override for `.rpc(fn, args)` — used by RPC-based service functions (e.g. get_trip_driver_info). */
  rpc?: (fn: string, args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
}

export function createFakeSupabaseClient(config: FakeClientConfig = {}): SupabaseClient<Database> {
  const auth = {
    signUp: async (args: unknown) =>
      config.signUp ? config.signUp(args) : { data: { session: null }, error: null },
    signInWithPassword: async (args: unknown) =>
      config.signInWithPassword ? config.signInWithPassword(args) : { data: { session: null }, error: null },
    setSession: async (args: unknown) =>
      config.setSession ? config.setSession(args) : { data: { session: null }, error: null },
    signOut: config.signOut ?? (async () => {}),
    getSession: config.getSession ?? (async () => ({ data: { session: null } })),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    resetPasswordForEmail: config.resetPasswordForEmail ?? (async () => ({ data: {}, error: null })),
    verifyOtp: config.verifyOtp ?? (async () => ({ data: { session: null }, error: null })),
    updateUser: config.updateUser ?? (async () => ({ data: {}, error: null })),
    mfa: {
      listFactors: config.mfa?.listFactors ?? (async () => ({ data: { totp: [] }, error: null })),
      getAuthenticatorAssuranceLevel:
        config.mfa?.getAuthenticatorAssuranceLevel ?? (async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null })),
      enroll: config.mfa?.enroll ?? (async () => ({ data: null, error: { message: 'enroll not configured' } })),
      challenge: config.mfa?.challenge ?? (async () => ({ data: { id: 'challenge-1' }, error: null })),
      verify: config.mfa?.verify ?? (async () => ({ data: {}, error: null })),
      unenroll: config.mfa?.unenroll ?? (async () => ({ data: {}, error: null })),
    },
  };

  const usersQuery = {
    select: () => usersQuery,
    eq: () => usersQuery,
    single: async () =>
      config.userRow
        ? { data: config.userRow, error: null }
        : { data: null, error: { message: 'not found' } },
  };

  const updateQuery = {
    eq: async () => ({ error: config.updateError ? { message: config.updateError } : null }),
  };

  const usersTable = {
    select: usersQuery.select,
    eq: usersQuery.eq,
    single: usersQuery.single,
    update: (row: unknown) => {
      config.onUsersUpdate?.(row);
      return updateQuery;
    },
  };

  // `.in()` terminates the consent query, so it is the only awaitable link.
  const consentsQuery = {
    select: () => consentsQuery,
    eq: (column: string, value: unknown) => {
      config.onConsentSelect?.(column, value);
      return consentsQuery;
    },
    in: async () =>
      config.consentSelectError
        ? { data: null, error: { message: config.consentSelectError } }
        : { data: config.consentRows ?? [], error: null },
  };

  const consentsTable = {
    select: consentsQuery.select,
    insert: async (rows: unknown) => {
      config.onConsentInsert?.(rows);
      return { error: config.consentInsertError ? { message: config.consentInsertError } : null };
    },
  };

  const from = (table: string) => {
    if (config.from) return config.from(table);
    return table === 'user_consents' ? consentsTable : usersTable;
  };

  const functions = {
    invoke: config.functionsInvoke ?? (async () => { throw new Error('functions.invoke not configured on fake client'); }),
  };

  return {
    auth,
    from,
    functions,
    rpc: config.rpc ?? (() => { throw new Error('rpc not configured on fake client'); }),
    channel: config.channel ?? (() => { throw new Error('channel not configured on fake client'); }),
    removeChannel: config.removeChannel ?? (() => {}),
  } as unknown as SupabaseClient<Database>;
}
