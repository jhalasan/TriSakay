import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/supabase/database.types';

export interface FakeConsentRow {
  policy_type: string;
  policy_version: string;
}

export interface FakeClientConfig {
  signUp?: (args: unknown) => Promise<{ data: { session: unknown }; error: { message: string } | null }>;
  signInWithPassword?: (
    args: unknown
  ) => Promise<{ data: { session: unknown }; error: { message: string } | null }>;
  getSession?: () => Promise<{ data: { session: unknown } }>;
  signOut?: () => Promise<void>;
  userRow?: Record<string, unknown> | null;
  updateError?: string | null;
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
}

export function createFakeSupabaseClient(config: FakeClientConfig = {}): SupabaseClient<Database> {
  const auth = {
    signUp: async (args: unknown) =>
      config.signUp ? config.signUp(args) : { data: { session: null }, error: null },
    signInWithPassword: async (args: unknown) =>
      config.signInWithPassword ? config.signInWithPassword(args) : { data: { session: null }, error: null },
    signOut: config.signOut ?? (async () => {}),
    getSession: config.getSession ?? (async () => ({ data: { session: null } })),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
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
    update: () => updateQuery,
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

  return {
    auth,
    from,
    channel: config.channel ?? (() => { throw new Error('channel not configured on fake client'); }),
    removeChannel: config.removeChannel ?? (() => {}),
  } as unknown as SupabaseClient<Database>;
}
