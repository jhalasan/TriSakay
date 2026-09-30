/**
 * In-app navigation helpers: where a driver is along a road route, how much of
 * it is left, and whether they have left it. Pure math on the polyline the
 * Routes API already returned, so following a driver costs no API calls.
 */

export interface RoutePoint {
  latitude: number;
  longitude: number;
}

export interface RouteSnap {
  /** Index of the route vertex that starts the segment the position projects onto. */
  segmentIndex: number;
  /** The position projected onto the route line. */
  point: RoutePoint;
  /** How far the position is from the line, in metres. */
  distanceM: number;
}

/** Further than this from the line counts as off route. */
export const OFF_ROUTE_METERS = 60;
/** ...and it must stay that way this long, so a GPS jitter or a corner cut doesn't trigger a re-route. */
export const OFF_ROUTE_SECONDS = 10;

const METERS_PER_DEGREE_LAT = 111_320;

/**
 * Projects `position` onto the nearest point of the route polyline. Uses a
 * local flat-earth approximation, which is accurate to well under a metre at
 * the few-hundred-metre scale of one segment. Null for a route with no segment.
 */
export function snapToRoute(route: RoutePoint[], position: RoutePoint): RouteSnap | null {
  if (route.length < 2) return null;
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos((position.latitude * Math.PI) / 180);
  const toXY = (p: RoutePoint) => ({
    x: (p.longitude - position.longitude) * metersPerDegreeLng,
    y: (p.latitude - position.latitude) * METERS_PER_DEGREE_LAT,
  });

  let best: RouteSnap | null = null;
  for (let i = 0; i < route.length - 1; i += 1) {
    const a = toXY(route[i]);
    const b = toXY(route[i + 1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    // Projection of the origin (the position) onto the segment, clamped to it.
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, (-a.x * dx - a.y * dy) / lengthSq));
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    const distanceM = Math.hypot(px, py);
    if (best === null || distanceM < best.distanceM) {
      best = {
        segmentIndex: i,
        distanceM,
        point: {
          latitude: route[i].latitude + t * (route[i + 1].latitude - route[i].latitude),
          longitude: route[i].longitude + t * (route[i + 1].longitude - route[i].longitude),
        },
      };
    }
  }
  return best;
}

/** The part of the route still ahead: the snapped point, then every vertex after it. */
export function remainingRoute(route: RoutePoint[], snap: RouteSnap): RoutePoint[] {
  return [snap.point, ...route.slice(snap.segmentIndex + 1)];
}
