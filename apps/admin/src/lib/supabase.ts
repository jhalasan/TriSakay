import { initSupabase } from '@trisakay/services';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill in your Supabase project values.'
  );
}

// No custom `storage` — the browser client defaults to window.localStorage,
// unlike the driver/passenger apps which pass AsyncStorage explicitly.
initSupabase({ url, anonKey });
