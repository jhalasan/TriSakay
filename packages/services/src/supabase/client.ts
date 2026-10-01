import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';

export interface InitSupabaseConfig {
  url: string;
  anonKey: string;
  storage?: SupportedStorage;
}

let client: SupabaseClient<Database> | null = null;
let initConfig: InitSupabaseConfig | null = null;
let passwordCheckOverride: SupabaseClient<Database> | null = null;

export function initSupabase(config: InitSupabaseConfig): SupabaseClient<Database> {
  initConfig = config;
  client = createClient<Database>(config.url, config.anonKey, {
    auth: {
      storage: config.storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!client) {
    throw new Error(
      'Supabase client not initialized. Call initSupabase() once at app startup before using any service.'
    );
  }
  return client;
}

/**
 * A throwaway client for re-checking a password. signInWithPassword on the app's own client would replace the live
 * session with a fresh password-only one, dropping an MFA-verified session back to the lower level (and with it
 * the right to change the password). This one keeps no session and never touches storage.
 */
export function getPasswordCheckClient(): SupabaseClient<Database> {
  if (passwordCheckOverride) return passwordCheckOverride;
  if (!initConfig) return getSupabaseClient();
  return createClient<Database>(initConfig.url, initConfig.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function __setSupabaseClientForTests(fake: SupabaseClient<Database>): void {
  client = fake;
  initConfig = null;
  passwordCheckOverride = null;
}

export function __setPasswordCheckClientForTests(fake: SupabaseClient<Database>): void {
  passwordCheckOverride = fake;
}
