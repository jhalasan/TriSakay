import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export type DiscountCategory = Database['public']['Enums']['discount_category'];
export type PassengerDiscount = Database['public']['Tables']['passenger_discounts']['Row'];

export interface ApplyForDiscountInput {
  userId: string;
  category: DiscountCategory;
  /** Local file URIs, e.g. from expo-image-picker. */
  frontUri: string;
  backUri: string;
  contentType?: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface ApplyForDiscountResult {
  error: string | null;
}

const EXTENSION_BY_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

async function uploadIdPhoto(userId: string, category: DiscountCategory, uri: string, side: 'front' | 'back', contentType: 'image/jpeg' | 'image/png' | 'image/webp') {
  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();
  const path = `${userId}/${category}-${side}-${Date.now()}.${EXTENSION_BY_TYPE[contentType]}`;
  const { error } = await getSupabaseClient().storage.from('discount-ids').upload(path, arrayBuffer, { contentType });
  return { path, error };
}

/**
 * Uploads the front and back ID photos to the private `discount-ids`
 * bucket under the passenger's own folder, then files the
 * `passenger_discounts` claim (`status` defaults to `pending` — only PSO
 * Supervisor/Admin can approve it, per RLS). Both sides are required so
 * PSO reviewers can check the ID's authenticity. The unique
 * `passenger_discounts_one_live_claim` index rejects a second submission
 * while one is still pending or already approved, surfaced here as a
 * plain error message rather than a thrown Postgres exception.
 */
export async function applyForDiscount({
  userId,
  category,
  frontUri,
  backUri,
  contentType = 'image/jpeg',
}: ApplyForDiscountInput): Promise<ApplyForDiscountResult> {
  try {
    const front = await uploadIdPhoto(userId, category, frontUri, 'front', contentType);
    if (front.error) return { error: front.error.message };

    const back = await uploadIdPhoto(userId, category, backUri, 'back', contentType);
    if (back.error) return { error: back.error.message };

    const { error: insertError } = await getSupabaseClient()
      .from('passenger_discounts')
      .insert({
        passenger_id: userId,
        category,
        id_photo_front_path: front.path,
        id_photo_back_path: back.path,
      });

    if (insertError) {
      return {
        error: insertError.code === '23505'
          ? 'You already have a discount application pending or approved.'
          : insertError.message,
      };
    }
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Application failed' };
  }
}

export interface GetMyDiscountResult {
  data: PassengerDiscount | null;
  error: string | null;
}

/** The signed-in passenger's current (most recent) discount claim, or null if they've never applied. */
export async function getMyDiscount(): Promise<GetMyDiscountResult> {
  const { data: session } = await getSupabaseClient().auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return { data: null, error: 'Not signed in' };

  const { data, error } = await getSupabaseClient()
    .from('passenger_discounts')
    .select('*')
    .eq('passenger_id', userId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return { data: data ?? null, error: error?.message ?? null };
}
