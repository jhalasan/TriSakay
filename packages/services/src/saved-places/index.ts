import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export type SavedPlaceRow = Database['public']['Tables']['saved_places']['Row'];

/** The curated set enforced by the `saved_places_icon_check` constraint — the only icon values a row can hold. */
export const SAVED_PLACE_ICONS = [
  'home-outline',
  'briefcase-outline',
  'school-outline',
  'cart-outline',
  'restaurant-outline',
  'medkit-outline',
  'people-outline',
  'location-outline',
] as const;

export type SavedPlaceIcon = (typeof SAVED_PLACE_ICONS)[number];

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
  label: string;
  icon: SavedPlaceIcon;
  address: string;
  latitude: number;
  longitude: number;
}

export interface SaveSavedPlaceResult {
  data: SavedPlaceRow | null;
  error: string | null;
}

/** Inserts a new saved place. Unlimited per rider — there is no singleton slot to replace. */
export async function saveSavedPlace(input: SaveSavedPlaceInput): Promise<SaveSavedPlaceResult> {
  const userId = await getSignedInUserId();
  if (!userId) return { data: null, error: 'Not signed in' };

  const { data, error } = await getSupabaseClient()
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
