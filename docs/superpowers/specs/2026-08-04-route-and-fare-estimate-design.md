# Route reveal and route-based fare estimate — design spec

**Date:** 2026-08-04
**Scope:** Passenger app. After the rider confirms a destination, draw an **initial suggested route** (nearest driving path from pickup to destination) on the confirm screen, and base the **fare estimate** on that route's road distance.
**Out of scope:** Destination picking (`set-destination.tsx` — already built), and sending the request / nearest-driver matching (`createRideRequest` + `finding-driver.tsx` — already built). This feature only adds the route reveal and the route-based distance that feeds the existing fare estimate.

## Problem

The confirm screen already renders `<OsmMap variant="route" caption="Route preview">`, but there is **no actual route** — the map is merely centered on the geometric midpoint of pickup and dropoff, and `OsmMap`/`mapHtml.ts` cannot draw a line at all (the code notes *"Markers/routes are a later step"*). The fare is computed from `haversineDistanceKm(pickup, dropoff)` — a straight crow-flies distance that ignores roads.

The desired behavior: once the rider confirms a destination, the app reveals an **initial suggested road route** (the nearest/shortest driving path) and estimates the fare from that route's distance. The route is a **suggestion**, not a commitment — the driver may take a different path, which is why the fare remains an **estimate** ("Final fare is confirmed at drop-off").

## Design

### Data flow

1. `confirm.tsx` reads `pickup` (GPS-resolved on the Home tab) and `dropoff` (chosen in `set-destination.tsx`) from `useBookingStore`.
2. On mount / whenever pickup or dropoff changes, call `fetchRouteEstimate(pickup, dropoff)` → OSRM.
3. Draw the returned polyline on the existing `<OsmMap variant="route">`, fitting both endpoints in frame.
4. Feed the route's road distance into the existing `estimateFare()` → `compute_fare` RPC (unchanged) for the fare estimate.
5. On "Request ride", persist the route's estimated distance to `createRideRequest` so the saved `distanceKm` matches the drawn route and quoted fare.

Everything is an **estimate**: the route is a suggested nearest path, the distance is that route's length, and the fare carries the existing "confirmed at drop-off" caveat.

### 1. Routing module — `apps/passenger/src/utils/route.ts` (NEW)

Deliberately mirrors the sibling `geocode.ts`: an external OSM-community HTTP service, a named User-Agent, one documented base URL to swap for production, and **never throws** — a routing failure degrades gracefully rather than crashing the screen.

```ts
export interface RouteEstimate {
  /** Road distance of the suggested route, in km. */
  distanceKm: number;
  /** Ordered points of the route line, for drawing on the map. */
  geometry: { latitude: number; longitude: number }[];
  /** 'osrm' = real road route; 'straight' = fallback line (OSRM unreachable). */
  source: 'osrm' | 'straight';
}

export async function fetchRouteEstimate(
  pickup: { latitude: number; longitude: number },
  dropoff: { latitude: number; longitude: number },
): Promise<RouteEstimate>;
```

- **Endpoint:** `GET {OSRM_BASE_URL}/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=geojson`
  where `OSRM_BASE_URL = 'https://router.project-osrm.org'`.
- **Parse:** `routes[0].distance` (meters → `/1000` km); `routes[0].geometry.coordinates` is an array of `[lon, lat]` pairs → map to `{ latitude, longitude }`. `source: 'osrm'`.
- **Fallback** — on non-OK HTTP, empty `routes`, malformed JSON, or a thrown fetch (offline): return a straight two-point line `[pickup, dropoff]` with `distanceKm = haversineDistanceKm(pickup, dropoff)` (from `@trisakay/utils`) and `source: 'straight'`. This guarantees the rider can always see a line and get a fare, so a routing outage never blocks a booking.
- **Provider note (mirrors the tile/Nominatim comments):** `router.project-osrm.org` is OSRM's public demo server, intended for light/evaluation use, not production load. `OSRM_BASE_URL` is the single point to swap for a self-hosted or commercial router. One route request per confirm screen keeps usage light.

### 2. Route rendering — `packages/ui/src/components/OsmMap`

Adds a polyline capability to the WebView map. Removes the *"Markers/routes are a later step"* caveat.

**`mapHtml.ts` — `MapHtmlOptions`:**
```ts
/** Ordered points of a route line to draw. When present, the map fits these
 *  bounds instead of using center/zoom. Endpoints get start (green) / end
 *  (blue) dots. */
route?: { latitude: number; longitude: number }[] | null;
```
- When `route` has ≥2 points: build a `L.polyline(points, { color: colors.accentBlue, weight: 5, opacity: 0.9 })`, add start/end circle markers (`colors.accentGreen` at index 0, `colors.accentBlue` at the last point), then frame it with `map.fitBounds(line.getBounds(), { paddingTopLeft: [24, 24], paddingBottomRight: [24, 24 + bottomInset] })` — the bottom padding lifts the line clear of any native overlay (`bottomInset`), consistent with how the attribution is already lifted. `fitBounds` supersedes the initial `center/zoom` when a route exists.
- Coordinates are interpolated into a `<script>` block; reuse the existing `finite()` guard so no non-numeric value can land in the page. Guard against `< 2` points (draw nothing, fall back to center/zoom).

**`OsmMap.tsx` — `OsmMapProps`:**
```ts
/** Draws a route line and frames it. See mapHtml route option. */
route?: { latitude: number; longitude: number }[] | null;
```
- Add `route` to the `source` useMemo dependencies. The route arrives asynchronously, so the map first renders with no line, then remounts **once** when the route resolves — the same single-remount behavior that a `latitude`/`longitude` change already causes. Document this next to the existing memo comment (which already explains why marker coordinates are excluded but lat/lng are not). One extra tile fetch per confirm screen is acceptable.
- Serialize the route into the memo dep via `JSON.stringify(route)` (or its length + first/last point) so a new-but-equal array reference doesn't force a needless remount.

### 3. Confirm screen — `apps/passenger/app/booking/confirm.tsx`

- New state: `const [route, setRoute] = useState<RouteEstimate | null>(null)`.
- New `useEffect` on `[pickup, dropoff]`: if both set, `fetchRouteEstimate(pickup, dropoff).then(setRoute)`; guarded by a `cancelled` flag like the existing effects. Clears `route` when either endpoint is missing.
- **Map:** pass `route={route?.geometry}` to the existing `<OsmMap variant="route">`. The midpoint-centering hack (`midpoint`) becomes the pre-route placeholder only (map still needs a sane initial center while the route loads); keep it for that first frame.
- **Fare:** the fare `useEffect` uses `route.distanceKm` as `distanceKm` instead of `haversineDistanceKm`. Gate on `route` being loaded — until then the card shows the existing "Estimating fare…" state. (Because `fetchRouteEstimate` always resolves with a distance, including the fallback, the fare is never permanently blocked.)
- **Request:** in `handleRequestRide`, use `route.distanceKm` (not a fresh `haversineDistanceKm`) for `createRideRequest`'s `distanceKm`, so the persisted distance matches the drawn route and quoted fare. Guard remains: don't proceed if `route === null` or `fare === null`.
- Copy: the existing fare note *"Final fare is confirmed at drop-off"* already frames the estimate correctly and stays. Optionally, when `route?.source === 'straight'`, the route caption can read "Approximate route" to signal the fallback — nice-to-have, not required.

### 4. Testing

- **`fetchRouteEstimate`** (passenger `tests/`): with a mocked `fetch` returning a sample OSRM GeoJSON response, assert `distanceKm` (meters→km) and `geometry` ([lon,lat]→{latitude,longitude}) parse correctly and `source==='osrm'`. With `fetch` rejecting / returning `!ok` / returning `{routes:[]}`, assert the straight-line fallback: two-point geometry `[pickup, dropoff]`, `distanceKm === haversineDistanceKm(pickup, dropoff)`, `source==='straight'`, and that it never throws.
- **`buildMapHtml`** (if a `mapHtml` test exists, else add a focused one): passing a `route` of ≥2 points includes an `L.polyline(...)` and a `fitBounds(` call in the generated HTML; passing `null`/`<2` points does not.

## What is NOT changing

- No new npm dependencies, no API keys, no app config.
- No database or RPC changes — `compute_fare` receives a more accurate `distanceKm` and is otherwise untouched.
- `set-destination.tsx`, `createRideRequest`, and `finding-driver.tsx` are unchanged — destination picking and driver matching already work.
