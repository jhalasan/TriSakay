import * as Location from 'expo-location';

/** How long "Go online" waits for a fresh GPS fix before falling back to the last known one. */
export const GO_ONLINE_GPS_TIMEOUT_MS = 8000;
/** A last-known position older than this isn't used: the server treats a driver location older than ~2 minutes as stale. */
const LAST_KNOWN_MAX_AGE_MS = 2 * 60 * 1000;

/**
 * A position for going online that can't hang. `getCurrentPositionAsync` has
 * no timeout of its own, so a slow fix (indoors, cold GPS) used to leave the
 * Go online button waiting indefinitely with no feedback. Wait a bounded time
 * for a fresh fix, then fall back to a recent last-known position; throws only
 * when neither is available.
 */
export async function getPositionForGoOnline(): Promise<Location.LocationObject> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('GPS fix timed out')), GO_ONLINE_GPS_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
    if (lastKnown) return lastKnown;
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
