import { useEffect, useMemo, useRef, useState } from 'react';
import { OFF_ROUTE_METERS, OFF_ROUTE_SECONDS, remainingRoute, snapToRoute, type RoutePoint } from './routeProgress';

export interface NavigationRouteResult {
  geometry: RoutePoint[];
  /** 'google' = a real road route; 'straight' = the fallback line (Google unreachable or over quota). */
  source: 'google' | 'straight';
}

export interface UseNavigationRouteArgs {
  /** The live position. Null until the first GPS fix. */
  origin: RoutePoint | null;
  /** Where the route ends. Null means nothing to navigate to. */
  destination: RoutePoint | null;
  /** Fetches a route; must never throw (fall back to a straight line instead). */
  fetchRoute: (origin: RoutePoint, destination: RoutePoint) => Promise<NavigationRouteResult>;
}

/** Re-routing after leaving the road is rate-limited so a bad GPS stretch can't burn the Routes quota. */
const MIN_REFETCH_MS = 15_000;
/** The fallback line is retried this often, in case Google has recovered. */
const STRAIGHT_RETRY_MS = 60_000;

/**
 * A road route from the live position to a destination that follows the
 * driver along it: the part already driven is trimmed off as they move, and a
 * new route is fetched when the destination changes or they leave the road for
 * more than a few seconds. Only those two events cost an API call.
 */
export function useNavigationRoute({ origin, destination, fetchRoute }: UseNavigationRouteArgs) {
  const [full, setFull] = useState<{ result: NavigationRouteResult; destKey: string } | null>(null);
  const originRef = useRef(origin);
  originRef.current = origin;
  const fetchRouteRef = useRef(fetchRoute);
  fetchRouteRef.current = fetchRoute;
  const lastFetchAtRef = useRef(0);
  const offRouteSinceRef = useRef<number | null>(null);
  const fetchIdRef = useRef(0);
  const inFlightRef = useRef(false);

  const destKey = destination ? `${destination.latitude.toFixed(5)},${destination.longitude.toFixed(5)}` : null;
  const hasOrigin = origin !== null;

  function load(key: string, dest: RoutePoint) {
    const from = originRef.current;
    if (!from || inFlightRef.current) return;
    inFlightRef.current = true;
    lastFetchAtRef.current = Date.now();
    offRouteSinceRef.current = null;
    const id = ++fetchIdRef.current;
    void fetchRouteRef
      .current(from, dest)
      .then((result) => {
        if (id === fetchIdRef.current) setFull({ result, destKey: key });
      })
      .catch(() => {
        // fetchRoute is documented not to throw; if it does, keep whatever line we already have.
      })
      .finally(() => {
        inFlightRef.current = false;
      });
  }

  // A new destination (the next stop changed) or the first GPS fix: fetch from where the driver is now.
  useEffect(() => {
    if (!destination || !destKey || !hasOrigin) {
      fetchIdRef.current += 1;
      inFlightRef.current = false;
      setFull(null);
      return;
    }
    load(destKey, destination);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the destination's value, not object identity.
  }, [destKey, hasOrigin]);

  // On every GPS fix: decide whether the driver has left the line long enough to re-route.
  const originLat = origin?.latitude;
  const originLng = origin?.longitude;
  useEffect(() => {
    if (!destination || !destKey || !origin || !full || full.destKey !== destKey) return;
    const now = Date.now();
    if (full.result.source === 'straight') {
      if (now - lastFetchAtRef.current >= STRAIGHT_RETRY_MS) load(destKey, destination);
      return;
    }
    const snap = snapToRoute(full.result.geometry, origin);
    if (!snap || snap.distanceM <= OFF_ROUTE_METERS) {
      offRouteSinceRef.current = null;
      return;
    }
    if (offRouteSinceRef.current === null) offRouteSinceRef.current = now;
    if (now - offRouteSinceRef.current >= OFF_ROUTE_SECONDS * 1000 && now - lastFetchAtRef.current >= MIN_REFETCH_MS) {
      load(destKey, destination);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs per position fix.
  }, [originLat, originLng]);

  const route = useMemo<RoutePoint[] | null>(() => {
    if (!destination || !destKey || !full || full.destKey !== destKey) return null;
    if (full.result.source === 'straight') return origin ? [origin, destination] : full.result.geometry;
    const snap = origin ? snapToRoute(full.result.geometry, origin) : null;
    return snap ? remainingRoute(full.result.geometry, snap) : full.result.geometry;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- origin's coordinates drive this, not its identity.
  }, [full, destKey, originLat, originLng]);

  return { route, source: full?.result.source ?? null };
}
