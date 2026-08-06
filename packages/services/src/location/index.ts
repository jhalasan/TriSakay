import { getSupabaseClient } from '../supabase/client.ts';

export interface Coordinates {
  lat: number;
  lng: number;
}

async function getSignedInUserId(): Promise<string | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * Translates the two business-rule exceptions `enforce_driver_verified_before_available()`
 * can raise (see docs/SCHEMA.MD §4) into copy a driver can act on. Any other
 * error (network, RLS, etc.) is passed through as-is.
 */
function toFriendlyMessage(message: string): string {
  if (message.includes('driver verification is not approved')) {
    return "You can't go online yet — your driver verification isn't approved.";
  }
  if (message.includes('no active, verified tricycle assigned')) {
    return "You can't go online yet — you don't have a verified tricycle on file.";
  }
  return message;
}

/**
 * Writes real availability + a one-time location fix to `driver_profiles`.
 * Going offline (`isAvailable: false`) needs no coords — the
 * `clear_location_when_offline` trigger nulls every location column
 * server-side regardless of what this call sends.
 */
export async function updateDriverAvailability(
  isAvailable: boolean,
  coords?: Coordinates
): Promise<{ error: string | null }> {
  const userId = await getSignedInUserId();
  if (!userId) return { error: 'Not signed in' };

  const patch = isAvailable
    ? {
        is_available: true,
        current_lat: coords?.lat ?? null,
        current_lng: coords?.lng ?? null,
        location_updated_at: new Date().toISOString(),
      }
    : { is_available: false };

  const { error } = await getSupabaseClient().from('driver_profiles').update(patch).eq('user_id', userId);

  if (error) return { error: toFriendlyMessage(error.message) };
  return { error: null };
}
