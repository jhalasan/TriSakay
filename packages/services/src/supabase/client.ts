import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';
import type { Database } from './database.types';

export interface InitSupabaseConfig {
  url: string;
  anonKey: string;
  storage?: SupportedStorage;
}

let client: SupabaseClient<Database> | null = null;

export function initSupabase(config: InitSupabaseConfig): SupabaseClient<Database> {
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

export function __setSupabaseClientForTests(fake: SupabaseClient<Database>): void {
  client = fake;
}
