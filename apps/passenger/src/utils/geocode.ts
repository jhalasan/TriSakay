import * as Location from 'expo-location';
import { getSupabaseClient } from '@trisakay/services';
import { DEFAULT_CENTER } from '@trisakay/ui';
import type { LocationPoint } from '../types/booking';

/**
 * G2 (Google Maps): primary search is now the maps-proxy Edge Function
 * (Places Text Search (New), server-side key + rate limit — see
 * supabase/functions/maps-proxy). Nominatim stays as the quiet fallback for
 * when the proxy fails or the caller has hit its hourly quota — this is the
 * SAME free community endpoint this app already used as its only search
 * before G2, so its own usage policy (one request per keystroke batch, a
 * named User-Agent, results bounded to the service area) still applies
 * whenever this path actually runs.
 */
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const SEARCH_USER_AGENT = 'TriSakayPassenger/1.0 (+mailto:nexasystems6@gmail.com)';
/** Degrees, matching the old service-area box every interactive map is clamped to (packages/ui's OsmMap). */
const SEARCH_BOX_DEGREES = 0.25;
const SEARCH_RESULT_LIMIT = 8;

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
}

async function searchPlacesNominatim(query: string): Promise<LocationPoint[]> {
  const south = DEFAULT_CENTER.latitude - SEARCH_BOX_DEGREES;
  const north = DEFAULT_CENTER.latitude + SEARCH_BOX_DEGREES;
  const west = DEFAULT_CENTER.longitude - SEARCH_BOX_DEGREES;
  const east = DEFAULT_CENTER.longitude + SEARCH_BOX_DEGREES;

  const params = new URLSearchParams({
    q: query,
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

interface MapsProxySearchResponse {
  results?: LocationPoint[];
  fallback?: boolean;
}

/**
 * Forward-geocodes free text to candidate destinations within the General
 * Santos City service area. Returns `[]` on total failure (offline, both
 * Google and Nominatim down, malformed response) rather than throwing — a
 * failed search should leave the rider looking at an empty results list,
 * not a crashed screen.
 */
export async function searchPlaces(query: string): Promise<LocationPoint[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  try {
    const { data, error } = await getSupabaseClient().functions.invoke<MapsProxySearchResponse>('maps-proxy', {
      body: { action: 'search', query: q },
    });
    if (!error && data && !data.fallback && data.results) {
      return data.results;
    }
  } catch {
    // Falls through to Nominatim below — offline, timeout, or the function itself unreachable.
  }

  return searchPlacesNominatim(q);
}

/**
 * Reverse-geocodes via the device's native geocoder (Android/iOS), not a
 * network API — no key, no Supabase round trip. Returns a generic fallback
 * label rather than throwing: a rider mid-drag should still get a pin with
 * coordinates even where the OS geocoder has no address (open field, spotty
 * data), not a stalled screen.
 *
 * `label` carries the street/locality (not a hardcoded "Pickup point") so
 * screens that display only `label` — the Request a Tricycle field, in
 * particular — show a value that visibly changed rather than the same
 * generic text before and after a successful fix.
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<LocationPoint> {
  try {
    const [result] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (result) {
      const street = [result.streetNumber, result.street].filter(Boolean).join(' ');
      const locality = [result.district, result.city ?? result.subregion].filter(Boolean).join(', ');
      const label = street || locality || 'Pinned location';
      const address = [street, locality].filter(Boolean).join(', ') || 'Pinned location';
      return { label, address, latitude, longitude };
    }
  } catch {
    // Falls through to the coordinate-only label below.
  }
  return {
    label: 'Pinned location',
    address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    latitude,
    longitude,
  };
}
