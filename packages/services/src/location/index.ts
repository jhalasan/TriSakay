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

/**
 * Reads the driver's current `is_available` straight from the backend.
 * Callers use this to re-sync client state on app boot/login — nothing
 * keeps the client's in-memory availability flag correct across app
 * restarts otherwise, since it's a plain local default.
 */
export async function getDriverAvailability(): Promise<{ isAvailable: boolean; error: string | null }> {
  const userId = await getSignedInUserId();
  if (!userId) return { isAvailable: false, error: 'Not signed in' };

  const { data, error } = await getSupabaseClient()
    .from('driver_profiles')
    .select('is_available')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { isAvailable: false, error: error.message };
  return { isAvailable: data?.is_available ?? false, error: null };
}

/**
 * Throttled writer for the continuous-watch path (apps/driver's
 * useDriverLocationSync). Unlike updateDriverAvailability, this never touches
 * is_available — it's called repeatedly while already online.
 */
export async function pushDriverLocation(coords: Coordinates): Promise<{ error: string | null }> {
  const userId = await getSignedInUserId();
  if (!userId) return { error: 'Not signed in' };

  const { error } = await getSupabaseClient()
    .from('driver_profiles')
    .update({
      current_lat: coords.lat,
      current_lng: coords.lng,
      location_updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) return { error: toFriendlyMessage(error.message) };
  return { error: null };
}

export interface DriverLocation {
  lat: number;
  lng: number;
  updatedAt: string;
}

/**
 * Live driver location for the ONE passenger currently matched to this
 * driver via an 'assigned' ride request — RLS policy
 * `driver_select_matched_passenger` is what actually restricts this to that
 * passenger; this function has no scoping logic of its own. Delivers `null`
 * when the row's coordinates are null (driver went offline — the
 * `clear_location_when_offline` trigger nulls them server-side).
 */
export function subscribeToDriverLocation(
  driverId: string,
  onUpdate: (loc: DriverLocation | null) => void
): () => void {
  const client = getSupabaseClient();
  const channel = client
    .channel(`driver_location_${driverId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'driver_profiles', filter: `user_id=eq.${driverId}` },
      (payload: { new: { current_lat: number | null; current_lng: number | null; location_updated_at: string | null } }) => {
        const row = payload.new;
        if (row.current_lat === null || row.current_lng === null || row.location_updated_at === null) {
          onUpdate(null);
          return;
        }
        onUpdate({ lat: row.current_lat, lng: row.current_lng, updatedAt: row.location_updated_at });
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
