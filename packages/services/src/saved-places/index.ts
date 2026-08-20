import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export type SavedPlaceKind = Database['public']['Enums']['saved_place_kind'];
export type SavedPlaceRow = Database['public']['Tables']['saved_places']['Row'];

async function getSignedInUserId(): Promise<string | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.user.id ?? null;
}

export interface ListSavedPlacesResult {
  data: SavedPlaceRow[];
  error: string | null;
}

/** Lists the signed-in user's own saved places, newest first (RLS: `saved_places_own`, `user_id = auth.uid()`). */
export async function listSavedPlaces(): Promise<ListSavedPlacesResult> {
  const userId = await getSignedInUserId();
  if (!userId) return { data: [], error: 'Not signed in' };

  const { data, error } = await getSupabaseClient()
    .from('saved_places')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return { data: data ?? [], error: error?.message ?? null };
}

export interface SaveSavedPlaceInput {
  kind: SavedPlaceKind;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface SaveSavedPlaceResult {
  data: SavedPlaceRow | null;
  error: string | null;
}

/**
 * Inserts a new saved place — except for 'home'/'work', which overwrite
 * whatever row of that kind already exists (queried, then updated by id)
 * rather than inserting a second one. Implemented as an explicit
 * select-then-write instead of a Postgres upsert: the uniqueness
 * constraint on (user_id, kind) is a *partial* index (only 'home'/'work'
 * rows), and supabase-js's `.upsert({ onConflict })` has no way to target
 * a partial index's WHERE predicate, so relying on it here would either
 * fail to find an arbiter or silently not apply to the rows that need it.
 */
export async function saveSavedPlace(input: SaveSavedPlaceInput): Promise<SaveSavedPlaceResult> {
  const userId = await getSignedInUserId();
  if (!userId) return { data: null, error: 'Not signed in' };
  const client = getSupabaseClient();

  if (input.kind === 'custom') {
    const { data, error } = await client
      .from('saved_places')
      .insert({ user_id: userId, ...input })
      .select()
      .single();
    return { data: data ?? null, error: error?.message ?? null };
  }

  const { data: existing } = await client
    .from('saved_places')
    .select('id')
    .eq('user_id', userId)
    .eq('kind', input.kind)
    .maybeSingle();

  if (existing) {
    const { data, error } = await client
      .from('saved_places')
      .update(input)
      .eq('id', existing.id)
      .select()
      .single();
    return { data: data ?? null, error: error?.message ?? null };
  }

  const { data, error } = await client
    .from('saved_places')
    .insert({ user_id: userId, ...input })
    .select()
    .single();
  return { data: data ?? null, error: error?.message ?? null };
}

export interface DeleteSavedPlaceResult {
  error: string | null;
}

/** Deletes one of the signed-in user's own saved places (RLS scopes this to their own rows regardless; the extra `user_id` filter makes that scoping visible in the query itself). */
export async function deleteSavedPlace(id: string): Promise<DeleteSavedPlaceResult> {
  const userId = await getSignedInUserId();
  if (!userId) return { error: 'Not signed in' };

  const { error } = await getSupabaseClient()
    .from('saved_places')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  return { error: error?.message ?? null };
}
