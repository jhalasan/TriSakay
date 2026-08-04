import { haversineDistanceKm } from '@trisakay/utils';

export interface RouteEstimate {
  /** Road distance of the suggested route, in km. */
  distanceKm: number;
  /** Ordered points of the route line, for drawing on the map. */
  geometry: { latitude: number; longitude: number }[];
  /** 'osrm' = real road route; 'straight' = fallback line (OSRM unreachable). */
  source: 'osrm' | 'straight';
}

interface GeoPoint {
  latitude: number;
  longitude: number;
}

/**
 * OSRM's public demo server — light/evaluation use only (one request per
 * confirm screen). Swap this single constant for a self-hosted or commercial
 * router in production, exactly like the tile URL note in OsmMap/mapHtml.ts.
 */
const OSRM_BASE_URL = 'https://router.project-osrm.org';
const ROUTE_USER_AGENT = 'TriSakayPassenger/1.0 (+mailto:nexasystems6@gmail.com)';

interface OsrmResponse {
  code?: string;
  routes?: { distance?: number; geometry?: { coordinates?: [number, number][] } }[];
}

/**
 * A two-point straight line + crow-flies distance. Returned on every OSRM
 * failure so the rider always sees a line and gets a fare — a routing outage
 * must never block a booking.
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
 * Fetches the nearest suggested driving route from pickup to dropoff via OSRM.
 * Returns the road distance and the line to draw. Never throws — any failure
 * degrades to `straightLine()`.
 */
export async function fetchRouteEstimate(pickup: GeoPoint, dropoff: GeoPoint): Promise<RouteEstimate> {
  // OSRM takes lon,lat — the reverse of the {latitude,longitude} used everywhere else.
  const coords = `${pickup.longitude},${pickup.latitude};${dropoff.longitude},${dropoff.latitude}`;
  const url = `${OSRM_BASE_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': ROUTE_USER_AGENT, Accept: 'application/json' },
    });
    if (!response.ok) return straightLine(pickup, dropoff);
    const data = (await response.json()) as OsrmResponse;
    const route = data.code === 'Ok' ? data.routes?.[0] : undefined;
    const coordinates = route?.geometry?.coordinates;
    if (!route || typeof route.distance !== 'number' || !coordinates || coordinates.length < 2) {
      return straightLine(pickup, dropoff);
    }
    return {
      distanceKm: route.distance / 1000,
      geometry: coordinates.map(([lon, lat]) => ({ latitude: lat, longitude: lon })),
      source: 'osrm',
    };
  } catch {
    return straightLine(pickup, dropoff);
  }
}
