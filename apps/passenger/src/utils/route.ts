import { getSupabaseClient } from '@trisakay/services';
import { haversineDistanceKm } from '@trisakay/utils';

export interface RouteEstimate {
  /** Road distance of the suggested route, in km. */
  distanceKm: number;
  /** Ordered points of the route line, for drawing on the map. */
  geometry: { latitude: number; longitude: number }[];
  /** 'google' = real road route via the Routes API; 'straight' = fallback line (Google unreachable/quota). */
  source: 'google' | 'straight';
}

interface GeoPoint {
  latitude: number;
  longitude: number;
}

interface MapsProxyRouteResponse {
  distanceKm?: number;
  geometry?: { latitude: number; longitude: number }[];
  fallback?: boolean;
}

/**
 * A two-point straight line + crow-flies distance. Returned whenever the
 * Google Routes API (via maps-proxy) is unreachable or over quota — a
 * routing outage must never block a booking. This used to also be OSRM's
 * fallback; G2 (Google Maps) removed OSRM entirely rather than keeping it
 * as a second fallback tier — see docs/UAT_PANELIST_REVIEW_ADRALES.md,
 * "## G2: full Google stack".
 */
function straightLine(pickup: GeoPoint, dropoff: GeoPoint): RouteEstimate {
  return {
    distanceKm: haversineDistanceKm(pickup, dropoff),
    geometry: [
      { latitude: pickup.latitude, longitude: pickup.longitude },
      { latitude: dropoff.latitude, longitude: dropoff.longitude },
    ],
    source: 'straight',
  };
}

/**
 * Fetches the nearest suggested driving route from pickup to dropoff via the
 * Google Routes API (through maps-proxy, which holds the server key and
 * rate-limits per user). Returns the road distance and the line to draw.
 * Never throws — any failure (offline, quota hit, malformed response)
 * degrades to `straightLine()`.
 */
export async function fetchRouteEstimate(pickup: GeoPoint, dropoff: GeoPoint): Promise<RouteEstimate> {
  try {
    const { data, error } = await getSupabaseClient().functions.invoke<MapsProxyRouteResponse>('maps-proxy', {
      body: { action: 'route', pickup, dropoff },
    });
    if (!error && data && !data.fallback && typeof data.distanceKm === 'number' && data.geometry && data.geometry.length >= 2) {
      return { distanceKm: data.distanceKm, geometry: data.geometry, source: 'google' };
    }
  } catch {
    // Falls through to the straight-line fallback below.
  }
  return straightLine(pickup, dropoff);
}
