import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export type DiscountCategory = Database['public']['Enums']['discount_category'];
export type PassengerDiscount = Database['public']['Tables']['passenger_discounts']['Row'];

export interface ApplyForDiscountInput {
  userId: string;
  category: DiscountCategory;
  /** A local file URI, e.g. from expo-image-picker. */
  uri: string;
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

/**
 * Uploads the ID photo to the private `discount-ids` bucket under the
 * passenger's own folder, then files the `passenger_discounts` claim
 * (`status` defaults to `pending` — only PSO Supervisor/Admin can approve
 * it, per RLS). The unique `passenger_discounts_one_live_claim` index
 * rejects a second submission while one is still pending or already
 * approved, surfaced here as a plain error message rather than a thrown
 * Postgres exception.
 */
export async function applyForDiscount({
  userId,
  category,
  uri,
  contentType = 'image/jpeg',
}: ApplyForDiscountInput): Promise<ApplyForDiscountResult> {
  try {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const path = `${userId}/${category}-${Date.now()}.${EXTENSION_BY_TYPE[contentType]}`;

    const { error: uploadError } = await getSupabaseClient()
      .storage.from('discount-ids')
      .upload(path, arrayBuffer, { contentType });
    if (uploadError) return { error: uploadError.message };

    const { error: insertError } = await getSupabaseClient()
      .from('passenger_discounts')
      .insert({ passenger_id: userId, category, id_photo_path: path });

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
