import * as Location from 'expo-location';
import { DEFAULT_CENTER } from '@trisakay/ui';
import type { LocationPoint } from '../types/booking';

/**
 * Same free community endpoint whose usage policy this app already honours
 * for map tiles (see `OsmMap/mapHtml.ts`) — one request per keystroke batch,
 * a named User-Agent, and results bounded to the service area rather than a
 * global search, so this stays inside "low-volume, non-bulk" use.
 */
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const SEARCH_USER_AGENT = 'TriSakayPassenger/1.0 (+mailto:nexasystems6@gmail.com)';
/** Degrees, matching `mapHtml.ts`'s ROAM_DEGREES — the same service-area box every interactive map is clamped to. */
const SEARCH_BOX_DEGREES = 0.25;
const SEARCH_RESULT_LIMIT = 8;

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
}

/**
 * Forward-geocodes free text to candidate destinations within the General
 * Santos City service area. Returns `[]` on any failure (offline, rate limit,
 * malformed response) rather than throwing — a failed search should leave the
 * rider looking at an empty results list, not a crashed screen.
 */
export async function searchPlaces(query: string): Promise<LocationPoint[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const south = DEFAULT_CENTER.latitude - SEARCH_BOX_DEGREES;
  const north = DEFAULT_CENTER.latitude + SEARCH_BOX_DEGREES;
  const west = DEFAULT_CENTER.longitude - SEARCH_BOX_DEGREES;
  const east = DEFAULT_CENTER.longitude + SEARCH_BOX_DEGREES;

  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    limit: String(SEARCH_RESULT_LIMIT),
    viewbox: `${west},${north},${east},${south}`,
    bounded: '1',
  });

  try {
    const response = await fetch(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
      headers: { 'User-Agent': SEARCH_USER_AGENT, Accept: 'application/json' },
    });
    if (!response.ok) return [];
    const results = (await response.json()) as NominatimResult[];
    return results.map((result) => {
      const [firstPart, ...rest] = result.display_name.split(',');
      return {
        label: (result.name || firstPart).trim(),
        address: rest.join(',').trim() || result.display_name,
        latitude: Number(result.lat),
        longitude: Number(result.lon),
      };
    });
  } catch {
    return [];
  }
}

/**
 * Reverse-geocodes via the device's native geocoder (Android/iOS), not a
 * network API — no key, no Supabase round trip. Returns a generic fallback
 * label rather than throwing: a rider mid-drag should still get a pin with
 * coordinates even where the OS geocoder has no address (open field, spotty
 * data), not a stalled screen.
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<LocationPoint> {
  try {
    const [result] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (result) {
      const street = [result.streetNumber, result.street].filter(Boolean).join(' ');
      const locality = [result.district, result.city ?? result.subregion].filter(Boolean).join(', ');
      const address = [street, locality].filter(Boolean).join(', ') || 'Pinned location';
      return { label: 'Pickup point', address, latitude, longitude };
    }
  } catch {
    // Falls through to the coordinate-only label below.
  }
  return {
    label: 'Pickup point',
    address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    latitude,
    longitude,
  };
}
