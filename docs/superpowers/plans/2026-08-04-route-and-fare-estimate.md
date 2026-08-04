# Route Reveal and Route-Based Fare Estimate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After the rider confirms a destination, draw an initial suggested driving route (pickup → destination) on the confirm screen and base the fare estimate on that route's road distance, falling back to a straight line when routing is unreachable.

**Architecture:** A new pure `fetchRouteEstimate()` util calls the OSRM public demo API and returns `{ distanceKm, geometry, source }`, degrading to a straight line + haversine on any failure. The existing `OsmMap`/`mapHtml` WebView gains a `route` prop that draws an `L.polyline` and fits it in frame. `confirm.tsx` wires the two together: it fetches the route, draws it, and feeds the routed distance into the existing `compute_fare` RPC and `createRideRequest`.

**Tech Stack:** Expo SDK 54 / React Native 0.81, TypeScript, Leaflet 1.9.4 in `react-native-webview`, OSRM demo API, `node:test` runner (Node 24, native TS type-stripping).

## Global Constraints

- **No new npm dependencies, no API keys, no app config, no DB/RPC changes.** `compute_fare` is untouched — it only receives a more accurate `distanceKm`.
- **`fetchRouteEstimate` must never throw** — every failure path returns a `source:'straight'` estimate so a routing outage never blocks a booking.
- **OSRM base URL lives in exactly one constant** (`OSRM_BASE_URL = 'https://router.project-osrm.org'`) with a "demo server — swap for production" comment, mirroring the tile/Nominatim notes in `mapHtml.ts` and `geocode.ts`.
- **User-Agent** on the OSRM request: `'TriSakayPassenger/1.0 (+mailto:nexasystems6@gmail.com)'` (matches the app's existing OSM-service UA).
- **Fare distance source:** routed road distance when available; straight-line haversine (`haversineDistanceKm` from `@trisakay/utils`) as the fallback.
- **Route framing:** `fitBounds` with `paddingTopLeft: [24, 24]`, `paddingBottomRight: [24, 24 + attributionBottom]` so the line clears any bottom overlay.
- **Estimate framing:** keep the existing "Final fare is confirmed at drop-off" copy; do not add binding-route language.
- **Colors:** `colors.accentBlue` for the route line + destination dot, `colors.accentGreen` for the pickup dot (from `@trisakay/ui` theme).

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `apps/passenger/src/utils/route.ts` | OSRM route fetch + straight-line fallback; pure, no RN | **Create** |
| `apps/passenger/tests/route.test.ts` | Unit tests for `fetchRouteEstimate` (mocked fetch) | **Create** |
| `apps/passenger/tests/mapHtml.test.ts` | Unit tests for `buildMapHtml` route rendering | **Create** |
| `apps/passenger/package.json` | `test` script glob to include `.ts` | **Modify** |
| `packages/ui/src/components/OsmMap/mapHtml.ts` | Add `route` option → polyline + fitBounds; import colors directly so the file is node-pure | **Modify** |
| `packages/ui/src/components/OsmMap/OsmMap.tsx` | Add `route` prop, thread into the memoized HTML | **Modify** |
| `apps/passenger/app/booking/confirm.tsx` | Fetch route, draw it, base fare + persisted distance on it | **Modify** |

**Task order:** Task 1 (route util, self-contained) → Task 2 (map rendering, self-contained) → Task 3 (confirm wiring, consumes 1 & 2).

---

### Task 1: `fetchRouteEstimate` route util

**Files:**
- Create: `apps/passenger/src/utils/route.ts`
- Test: `apps/passenger/tests/route.test.ts`
- Modify: `apps/passenger/package.json` (test glob)

**Interfaces:**
- Consumes: `haversineDistanceKm(from, to)` from `@trisakay/utils` (great-circle km).
- Produces:
  ```ts
  export interface RouteEstimate {
    distanceKm: number;
    geometry: { latitude: number; longitude: number }[];
    source: 'osrm' | 'straight';
  }
  export function fetchRouteEstimate(
    pickup: { latitude: number; longitude: number },
    dropoff: { latitude: number; longitude: number },
  ): Promise<RouteEstimate>;
  ```

- [ ] **Step 1: Update the passenger test script to discover `.ts` tests**

In `apps/passenger/package.json`, change the `test` script:
```json
"test": "node --test ./tests/*.test.js ./tests/*.test.ts"
```
(Node's test runner expands these glob patterns itself, so this works on Windows. `sample.test.js` keeps running.)

- [ ] **Step 2: Write the failing test**

Create `apps/passenger/tests/route.test.ts`:
```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineDistanceKm } from '@trisakay/utils';
import { fetchRouteEstimate } from '../src/utils/route.ts';

const PICKUP = { latitude: 6.1164, longitude: 125.1717 };
const DROPOFF = { latitude: 6.12, longitude: 125.18 };

function mockFetch(impl: typeof globalThis.fetch) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return () => { globalThis.fetch = original; };
}

test('parses an OSRM geojson route into km + {latitude,longitude} points', async () => {
  const restore = mockFetch((async () => ({
    ok: true,
    json: async () => ({
      code: 'Ok',
      routes: [{
        distance: 2500,
        geometry: { coordinates: [[125.1717, 6.1164], [125.176, 6.1182], [125.18, 6.12]] },
      }],
    }),
  })) as unknown as typeof globalThis.fetch);
  try {
    const result = await fetchRouteEstimate(PICKUP, DROPOFF);
    assert.equal(result.source, 'osrm');
    assert.equal(result.distanceKm, 2.5);
    assert.equal(result.geometry.length, 3);
    assert.deepEqual(result.geometry[0], { latitude: 6.1164, longitude: 125.1717 });
    assert.deepEqual(result.geometry[2], { latitude: 6.12, longitude: 125.18 });
  } finally { restore(); }
});

test('falls back to a straight line + haversine when OSRM returns not-ok', async () => {
  const restore = mockFetch((async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof globalThis.fetch);
  try {
    const result = await fetchRouteEstimate(PICKUP, DROPOFF);
    assert.equal(result.source, 'straight');
    assert.equal(result.geometry.length, 2);
    assert.equal(result.distanceKm, haversineDistanceKm(PICKUP, DROPOFF));
  } finally { restore(); }
});

test('falls back to a straight line when fetch throws (offline)', async () => {
  const restore = mockFetch((async () => { throw new Error('network'); }) as unknown as typeof globalThis.fetch);
  try {
    const result = await fetchRouteEstimate(PICKUP, DROPOFF);
    assert.equal(result.source, 'straight');
    assert.equal(result.distanceKm, haversineDistanceKm(PICKUP, DROPOFF));
  } finally { restore(); }
});

test('falls back when OSRM code is not Ok (no route found)', async () => {
  const restore = mockFetch((async () => ({ ok: true, json: async () => ({ code: 'NoRoute', routes: [] }) })) as unknown as typeof globalThis.fetch);
  try {
    const result = await fetchRouteEstimate(PICKUP, DROPOFF);
    assert.equal(result.source, 'straight');
  } finally { restore(); }
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd apps/passenger && node --test ./tests/route.test.ts`
Expected: FAIL — cannot resolve `../src/utils/route.ts` (module doesn't exist yet).

- [ ] **Step 4: Write the implementation**

Create `apps/passenger/src/utils/route.ts`:
```ts
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd apps/passenger && node --test ./tests/route.test.ts`
Expected: PASS — 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/passenger/src/utils/route.ts apps/passenger/tests/route.test.ts apps/passenger/package.json
git commit -m "feat(passenger): add fetchRouteEstimate OSRM util with straight-line fallback"
```

---

### Task 2: Route rendering in `OsmMap` / `mapHtml`

**Files:**
- Modify: `packages/ui/src/components/OsmMap/mapHtml.ts`
- Modify: `packages/ui/src/components/OsmMap/OsmMap.tsx`
- Test: `apps/passenger/tests/mapHtml.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces (both `MapHtmlOptions` and `OsmMapProps` gain):
  ```ts
  route?: { latitude: number; longitude: number }[] | null;
  ```
  `buildMapHtml({ ...previous, route })` returns HTML containing an `L.polyline(...)` + `fitBounds(...)` when `route` has ≥2 points.

- [ ] **Step 1: Make `mapHtml.ts` node-pure (direct colors import)**

In `packages/ui/src/components/OsmMap/mapHtml.ts`, change the top import from the theme barrel (which transitively imports `react-native` via `motion`/`elevation`/`typography`) to the pure colors file:
```ts
import { colors } from '../../theme/colors';
```
(`colors.ts` has no imports; this lets the HTML builder be unit-tested under `node --test`. `OsmMap.tsx` and the styles file keep importing from `../../theme` as before.)

- [ ] **Step 2: Write the failing test**

Create `apps/passenger/tests/mapHtml.test.ts`:
```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMapHtml } from '../../../packages/ui/src/components/OsmMap/mapHtml.ts';

const ROUTE = [
  { latitude: 6.1164, longitude: 125.1717 },
  { latitude: 6.118, longitude: 125.176 },
  { latitude: 6.12, longitude: 125.18 },
];

test('draws a polyline and fits bounds when a route of >=2 points is given', () => {
  const html = buildMapHtml({ latitude: 6.1, longitude: 125.1, zoom: 14, route: ROUTE });
  assert.match(html, /L\.polyline\(/);
  assert.match(html, /fitBounds\(/);
  // the route coordinates are embedded as [lat, lng] pairs
  assert.match(html, /6\.1164/);
});

test('omits the polyline when no route is given', () => {
  const html = buildMapHtml({ latitude: 6.1, longitude: 125.1, zoom: 14 });
  assert.doesNotMatch(html, /L\.polyline\(/);
});

test('omits the polyline for a single-point route', () => {
  const html = buildMapHtml({ latitude: 6.1, longitude: 125.1, zoom: 14, route: [ROUTE[0]] });
  assert.doesNotMatch(html, /L\.polyline\(/);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd apps/passenger && node --test ./tests/mapHtml.test.ts`
Expected: FAIL — `route` isn't rendered yet, so `L.polyline(` is absent.

- [ ] **Step 4: Add the `route` option to `MapHtmlOptions`**

In `mapHtml.ts`, add to the `MapHtmlOptions` interface (after `tapToPlace`):
```ts
  /**
   * An ordered list of points to draw as a route line. When it has >=2 points
   * the map draws an accent polyline, a green pickup dot and a blue destination
   * dot, and frames the whole line with fitBounds — superseding center/zoom.
   * The line is a *suggested* route (estimate), not a committed path.
   */
  route?: { latitude: number; longitude: number }[] | null;
```

- [ ] **Step 5: Sanitize the route points in `buildMapHtml`**

In `buildMapHtml`, add `route = null` to the destructured params, and after the existing `markerDraggable` line, build a safe `[lat, lng]` array (reusing the existing `finite()` guard so nothing non-numeric reaches the `<script>` block):
```ts
  const routePoints = (route ?? [])
    .map((point) => [finite(point.latitude, NaN), finite(point.longitude, NaN)])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  const routeJson = JSON.stringify(routePoints);
```

- [ ] **Step 6: Draw the polyline in the page script**

In the `<script>` body of the returned HTML, immediately **after** the `layer.addTo(map);` line (before the `var pin = null;` block), insert:
```js
    var ROUTE = ${routeJson};
    if (ROUTE.length >= 2) {
      var routeLine = L.polyline(ROUTE, { color: '${colors.accentBlue}', weight: 5, opacity: 0.9 });
      routeLine.addTo(map);
      L.circleMarker(ROUTE[0], { radius: 7, weight: 2, color: '#fff', fillColor: '${colors.accentGreen}', fillOpacity: 1 }).addTo(map);
      L.circleMarker(ROUTE[ROUTE.length - 1], { radius: 7, weight: 2, color: '#fff', fillColor: '${colors.accentBlue}', fillOpacity: 1 }).addTo(map);
      map.fitBounds(routeLine.getBounds(), { paddingTopLeft: [24, 24], paddingBottomRight: [24, 24 + ${attributionBottom}] });
    }
```

- [ ] **Step 7: Make the recenter button refit the route (not jump to a point)**

Still in the `<script>`, inside the `if (INTERACTIVE) { ... }` block, change the body of `window.__recenter` so that when a route exists it refits the line instead of `setView(HOME, ...)`. Replace the single `map.setView(HOME, HOME_ZOOM, { animate: true });` line inside `__recenter` with:
```js
        if (typeof routeLine !== 'undefined' && ROUTE.length >= 2) {
          map.fitBounds(routeLine.getBounds(), { paddingTopLeft: [24, 24], paddingBottomRight: [24, 24 + ${attributionBottom}], animate: true });
        } else {
          map.setView(HOME, HOME_ZOOM, { animate: true });
        }
```
(`routeLine` is declared with `var`, so it's function-scoped and visible here; the `typeof` guard covers the no-route case.)

- [ ] **Step 8: Run the mapHtml test to verify it passes**

Run: `cd apps/passenger && node --test ./tests/mapHtml.test.ts`
Expected: PASS — 3 tests pass.

- [ ] **Step 9: Add the `route` prop to `OsmMap.tsx`**

In `OsmMap.tsx`, add to `OsmMapProps` (after `tapToPlace`):
```ts
  /** Draws a suggested route line and frames it. See mapHtml's `route` option. */
  route?: { latitude: number; longitude: number }[] | null;
```
Add `route = null,` to the destructured props (after `tapToPlace = false,`).

Pass it into `buildMapHtml` inside the `source` memo:
```ts
      html: buildMapHtml({
        latitude,
        longitude,
        zoom,
        attributionLeft,
        interactive,
        bottomInset,
        marker,
        tapToPlace,
        route,
      }),
```

Add the route to the memo dependency array so the line appears once the route resolves. Update the dependency list to:
```ts
    [latitude, longitude, zoom, attributionLeft, interactive, bottomInset, Boolean(marker), marker?.draggable, tapToPlace, JSON.stringify(route ?? null)],
```
And extend the existing eslint-disable comment note above it to mention the route is serialized so an equal-but-new array reference doesn't force a remount, and that the route resolving async causes exactly one remount (same as a lat/lng change).

- [ ] **Step 10: Typecheck the workspace**

Run: `npm run typecheck` (from repo root)
Expected: PASS — no type errors from the new `route` prop/option.

- [ ] **Step 11: Commit**

```bash
git add packages/ui/src/components/OsmMap/mapHtml.ts packages/ui/src/components/OsmMap/OsmMap.tsx apps/passenger/tests/mapHtml.test.ts
git commit -m "feat(ui): draw a route polyline + fitBounds in OsmMap"
```

---

### Task 3: Wire route + route-based fare into the confirm screen

**Files:**
- Modify: `apps/passenger/app/booking/confirm.tsx`

**Interfaces:**
- Consumes: `fetchRouteEstimate` + `RouteEstimate` from Task 1 (`../../src/utils/route`); `route` prop on `OsmMap` from Task 2.
- Produces: no new exports — this is the integration point.

> No `node:test` unit test: `confirm.tsx` is a React Native screen with no RN test runner in this repo. Verification is `npm run typecheck` plus the manual smoke checklist in Step 6. Logic under test (route fetch, fallback) is already covered by Task 1.

- [ ] **Step 1: Import the route util**

In `apps/passenger/app/booking/confirm.tsx`, add near the other local imports (below the `formatCurrency` import):
```ts
import { fetchRouteEstimate, type RouteEstimate } from '../../src/utils/route';
```
Keep the existing `haversineDistanceKm` import — it stays as the request-time fallback.

- [ ] **Step 2: Add route state**

After the existing `const [discountRatePercent, setDiscountRatePercent] = useState<number | null>(null);` line, add:
```ts
  const [route, setRoute] = useState<RouteEstimate | null>(null);
```

- [ ] **Step 3: Fetch the route when the endpoints change**

Add a new effect immediately **above** the existing fare `useEffect` (the one starting `if (!pickup || !dropoff) { setFare(null);`):
```ts
  // Fetch the suggested route (line + road distance) whenever the trip's
  // endpoints change. fetchRouteEstimate never throws — it degrades to a
  // straight line + haversine distance when OSRM is unreachable.
  useEffect(() => {
    if (!pickup || !dropoff) {
      setRoute(null);
      return;
    }
    let cancelled = false;
    fetchRouteEstimate(pickup, dropoff).then((result) => {
      if (!cancelled) setRoute(result);
    });
    return () => {
      cancelled = true;
    };
  }, [pickup, dropoff]);
```

- [ ] **Step 4: Base the fare on the routed distance**

Replace the existing fare effect body so it waits for the route and uses its distance. Change:
```ts
  useEffect(() => {
    if (!pickup || !dropoff) {
      setFare(null);
      return;
    }

    let cancelled = false;
    const distanceKm = haversineDistanceKm(pickup, dropoff);

    setFareError(null);
    estimateFare({ distanceKm, seats, passengerId: user?.id }).then((result) => {
      if (cancelled) return;
      setFare(result.fare);
      if (result.error) setFareError(result.error);
    });

    return () => {
      cancelled = true;
    };
  }, [pickup, dropoff, seats, user?.id, setFare]);
```
to:
```ts
  useEffect(() => {
    if (!pickup || !dropoff || !route) {
      setFare(null);
      return;
    }

    let cancelled = false;
    setFareError(null);
    estimateFare({ distanceKm: route.distanceKm, seats, passengerId: user?.id }).then((result) => {
      if (cancelled) return;
      setFare(result.fare);
      if (result.error) setFareError(result.error);
    });

    return () => {
      cancelled = true;
    };
  }, [pickup, dropoff, route, seats, user?.id, setFare]);
```

- [ ] **Step 5: Draw the route on the map and persist its distance**

5a. Pass the route geometry to the map. In the `<OsmMap variant="route" ... />` block, add the `route` prop (after `interactive`):
```tsx
          interactive
          route={route?.geometry}
```

5b. In `handleRequestRide`, change the request distance to the routed distance (with the same haversine fallback for safety). Replace:
```ts
    const distanceKm = haversineDistanceKm(pickup, dropoff);
```
with:
```ts
    const distanceKm = route?.distanceKm ?? haversineDistanceKm(pickup, dropoff);
```

- [ ] **Step 6: Typecheck and manual smoke test**

Run: `npm run typecheck` (from repo root) — Expected: PASS.

Then start the app and verify (Expo):
```bash
npm run start:passenger
```
Manual checklist:
- Pick a destination (search or drop a pin) → Confirm → land on the confirm screen.
- The map shows a **line** from the pickup (green dot) to the destination (blue dot), with both ends framed.
- The "Estimated fare" card resolves from "—"/"Estimating fare…" to a peso amount.
- Turn off Wi-Fi/data and repeat: a **straight** line still appears and a fare still resolves (fallback path).
- Tapping "Request ride" proceeds to finding-driver as before.

- [ ] **Step 7: Commit**

```bash
git add apps/passenger/app/booking/confirm.tsx
git commit -m "feat(passenger): reveal route + base fare on routed distance on confirm"
```

---

## Self-Review

**Spec coverage:**
- Routing module `route.ts` with OSRM + straight-line fallback → Task 1. ✅
- `RouteEstimate` shape (`distanceKm`/`geometry`/`source`) → Task 1. ✅
- Polyline + endpoint dots + fitBounds in `mapHtml`/`OsmMap`; removes the "later step" gap → Task 2. ✅
- Confirm screen: fetch route, draw it, fare from routed distance, persist routed distance → Task 3. ✅
- Estimate framing (existing "confirmed at drop-off" copy retained) → Task 3 (no copy change, per spec). ✅
- Tests: `fetchRouteEstimate` parse + 3 fallback paths (Task 1); `buildMapHtml` route on/off (Task 2). ✅
- Optional "Approximate route" caption for the fallback was called out as nice-to-have in the spec and is intentionally **not** implemented, to keep scope tight. (Not a gap — explicitly optional.)

**Placeholder scan:** No TBD/TODO/"handle edge cases" — every step has concrete code or an exact command. ✅

**Type consistency:** `RouteEstimate.geometry` is `{latitude, longitude}[]` everywhere; `OsmMap`/`mapHtml` `route` prop is the same shape; `route?.geometry` passed to `OsmMap`, `route.distanceKm` to `estimateFare`/`createRideRequest`. `fetchRouteEstimate` name identical across Task 1 and Task 3. ✅
