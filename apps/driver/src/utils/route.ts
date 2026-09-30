import { getSupabaseClient } from '@trisakay/services';
import type { NavigationRouteResult } from '@trisakay/ui';

interface GeoPoint {
  latitude: number;
  longitude: number;
}

interface MapsProxyRouteResponse {
  geometry?: GeoPoint[];
  fallback?: boolean;
}

/**
 * The driver's in-app navigation route, from the driver's live position to the
 * next stop, via the same maps-proxy Google Routes call the passenger app uses.
 * Never throws: any failure (offline, quota, malformed response) degrades to a
 * straight line, so navigation can never block a trip.
 */
export async function fetchNavigationRoute(origin: GeoPoint, destination: GeoPoint): Promise<NavigationRouteResult> {
  try {
    const { data, error } = await getSupabaseClient().functions.invoke<MapsProxyRouteResponse>('maps-proxy', {
      body: { action: 'route', pickup: origin, dropoff: destination },
    });
    if (!error && data && !data.fallback && data.geometry && data.geometry.length >= 2) {
      return { geometry: data.geometry, source: 'google' };
    }
  } catch {
    // Falls through to the straight line below.
  }
  return { geometry: [origin, destination], source: 'straight' };
}
