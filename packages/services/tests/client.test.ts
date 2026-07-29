import test from 'node:test';
import assert from 'node:assert/strict';
import { getSupabaseClient, initSupabase } from '../src/supabase/client.ts';

test('getSupabaseClient throws before initSupabase has been called', () => {
  assert.throws(() => getSupabaseClient(), /not initialized/);
});

test('initSupabase returns a client and getSupabaseClient returns the same instance', () => {
  const client = initSupabase({ url: 'https://example.supabase.co', anonKey: 'test-anon-key' });
  assert.equal(getSupabaseClient(), client);
});
