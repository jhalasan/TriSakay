// Subpath import, not the '../../theme' barrel: the barrel re-exports RN-dependent
// modules (typography/motion/gradients/elevation) that would break `node --test`
// loading this file directly; '#theme/colors' maps to the RN-free colors.ts (see
// packages/ui/package.json "imports").
import { colors } from '#theme/colors';

/**
 * TILE SOURCE — READ BEFORE CHANGING
 *
 * `tile.openstreetmap.org` is the OSM Foundation's free community service. Its
 * usage policy (https://operations.osmfoundation.org/policies/tiles/) permits
 * development and low-volume use only, and requires:
 *   1. visible "© OpenStreetMap contributors" attribution  → attributionControl below
 *   2. a unique User-Agent naming the app                  → applicationNameForUserAgent in OsmMap.tsx
 *   3. no bulk downloading / tile pre-fetching             → ROAM_BOUNDS + INTERACTIVE_MIN_ZOOM below
 *   4. honouring HTTP cache headers                        → WebView cacheEnabled stays true
 * OSMF may block usage that degrades the service, without notice.
 *
 * For production, move to a commercial or self-hosted provider (MapTiler,
 * Thunderforest, Stadia, or switch2osm.org). That swap is this URL plus the
 * attribution string — deliberately kept to one place.
 */
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
/** Leaflet's own standard credit — restored via `prefix` below alongside the OSM tile credit. */
const LEAFLET_ATTRIBUTION =
  '<a href="https://leafletjs.com" title="A JavaScript library for interactive maps">Leaflet</a>';

/** Leaflet 1.9.4. SRI hashes computed from the published files. */
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_CSS_SRI = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_JS_SRI = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';

/** General Santos City centre. */
export const DEFAULT_CENTER = { latitude: 6.116243, longitude: 125.171738 } as const;
export const DEFAULT_ZOOM = 15;

/**
 * How far an interactive map may roam from the city centre, in degrees (~27 km).
 * Two jobs: a stray fling can't strand the rider looking at open ocean, and no
 * single gesture can walk the viewport across the planet pulling tiles — which
 * is the honest version of the "no bulk downloading" rule now that panning is
 * allowed. Applied only when interactive; a frozen map has nothing to clamp.
 */
const ROAM_DEGREES = 0.25;

/** Floor for interactive zoom. Below city scale one pinch requests a lot of tiles. */
const INTERACTIVE_MIN_ZOOM = 12;

/** Must outlast Leaflet's pan/zoom animation (250ms default). See __recenter. */
const RECENTER_SETTLE_MS = 600;

export interface MapHtmlOptions {
  latitude: number;
  longitude: number;
  zoom: number;
  /** Bottom-left instead of bottom-right, where a bottom overlay would cover it. */
  attributionLeft?: boolean;
  /** Pan/pinch/double-tap + a recenter bridge. Off means the map is inert. */
  interactive?: boolean;
  /** Pixels of the map's bottom edge covered by a native overlay. Lifts attribution. */
  bottomInset?: number;
  /**
   * Initial marker position only — moving it after mount (a drag, or a fresher
   * GPS fix) must not remount the WebView and re-fetch every tile, so callers
   * intentionally leave this out of whatever memoizes the HTML string once the
   * map exists. Use `draggable` to let the rider fine-tune the pin by hand.
   */
  marker?: { latitude: number; longitude: number; draggable?: boolean } | null;
  /**
   * Tapping the map drops (or, once one exists, relocates) the marker there —
   * for a destination-picking map. Off by default: a rider's pickup pin (home)
   * should only move by explicit drag, not by an incidental tap while panning.
   */
  tapToPlace?: boolean;
  /**
   * An ordered list of points to draw as a route line. When it has >=2 points
   * the map draws an accent polyline, a green pickup dot and a blue destination
   * dot, and frames the whole line with fitBounds — superseding center/zoom.
   * The line is a *suggested* route (estimate), not a committed path.
   */
  route?: { latitude: number; longitude: number }[] | null;
}

/** Messages the page posts back over the WebView bridge. */
export type MapMessage =
  | { type: 'ready' }
  | { type: 'error'; reason: string }
  /** The rider moved the map off its home view. Fires once until recentred. */
  | { type: 'moved' }
  | { type: 'recentered' }
  /** The rider dropped the draggable marker at a new spot, by drag or by tap. */
  | { type: 'marker-moved'; latitude: number; longitude: number };

const finite = (value: number, fallback: number) =>
  Number.isFinite(value) ? Number(value) : fallback;

export function buildMapHtml({
  latitude,
  longitude,
  zoom,
  attributionLeft = false,
  interactive = false,
  bottomInset = 0,
  marker = null,
  tapToPlace = false,
  route = null,
}: MapHtmlOptions): string {
  // Nothing interpolated below may be non-numeric — these values land inside a
  // <script> block.
  const lat = finite(latitude, DEFAULT_CENTER.latitude);
  const lng = finite(longitude, DEFAULT_CENTER.longitude);
  const z = Math.min(19, Math.max(3, Math.round(finite(zoom, DEFAULT_ZOOM))));
  const attributionPosition = attributionLeft ? 'bottomleft' : 'bottomright';
  const attributionBottom = 6 + Math.max(0, finite(bottomInset, 0));
  const markerLat = marker ? finite(marker.latitude, lat) : lat;
  const markerLng = marker ? finite(marker.longitude, lng) : lng;
  const markerDraggable = Boolean(marker?.draggable);
  const routePoints = (route ?? [])
    .map((point) => [finite(point.latitude, NaN), finite(point.longitude, NaN)])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  const routeJson = JSON.stringify(routePoints);
  // Built conditionally (not just runtime-gated) so a route-less map's HTML
  // carries no polyline code at all — callers/tests can tell "no route" apart
  // from "route with < 2 points" by string content alone.
  const routeScript =
    routePoints.length >= 2
      ? `
    var ROUTE = ${routeJson};
    if (ROUTE.length >= 2) {
      var routeLine = L.polyline(ROUTE, { color: '${colors.accentBlue}', weight: 5, opacity: 0.9 });
      routeLine.addTo(map);
      L.circleMarker(ROUTE[0], { radius: 7, weight: 2, color: '#fff', fillColor: '${colors.accentGreen}', fillOpacity: 1 }).addTo(map);
      L.circleMarker(ROUTE[ROUTE.length - 1], { radius: 7, weight: 2, color: '#fff', fillColor: '${colors.accentBlue}', fillOpacity: 1 }).addTo(map);
      map.fitBounds(routeLine.getBounds(), { paddingTopLeft: [24, 24], paddingBottomRight: [24, 24 + ${attributionBottom}] });
    }
`
      : '';

  // Built conditionally, same reasoning as routeScript: without a pickup pin
  // to draw a line to, this bridge is meaningless, and its absence must be
  // provable from the generated HTML by string content alone (no L.polyline(
  // reference at all when there is no marker).
  const driverMarkerScript = marker
    ? `
      var driverMarker = null;
      var driverLine = null;
      var driverIcon = L.divIcon({
        className: '',
        html: '<div style="width:22px;height:22px;border-radius:50%;background:${colors.accentGreen};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      window.__setDriverLocation = function (lat, lng) {
        if (!pin) return; // no fixed pickup point to draw a line to
        var pinPos = pin.getLatLng();
        var point = [lat, lng];
        if (!driverMarker) {
          driverMarker = L.marker(point, { icon: driverIcon }).addTo(map);
          driverLine = L.polyline([point, [pinPos.lat, pinPos.lng]], { color: '${colors.accentGreen}', weight: 4, dashArray: '6,6', opacity: 0.85 }).addTo(map);
        } else {
          driverMarker.setLatLng(point);
          driverLine.setLatLngs([point, [pinPos.lat, pinPos.lng]]);
        }
      };
      window.__clearDriverLocation = function () {
        if (driverMarker) { map.removeLayer(driverMarker); driverMarker = null; }
        if (driverLine) { map.removeLayer(driverLine); driverLine = null; }
      };
`
    : '';

  // Anchored on the city centre rather than this screen's centre, so every
  // interactive map roams the same, predictable box.
  const south = DEFAULT_CENTER.latitude - ROAM_DEGREES;
  const north = DEFAULT_CENTER.latitude + ROAM_DEGREES;
  const west = DEFAULT_CENTER.longitude - ROAM_DEGREES;
  const east = DEFAULT_CENTER.longitude + ROAM_DEGREES;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<link rel="stylesheet" href="${LEAFLET_CSS}" integrity="${LEAFLET_CSS_SRI}" crossorigin="anonymous" />
<style>
  html, body { margin:0; padding:0; height:100%; overflow:hidden; background:${colors.fill}; }
  /* Longhand rather than inset: Android System WebView on budget handsets can predate inset support. */
  #map { position:absolute; top:0; left:0; right:0; bottom:0; background:${colors.fill}; }
  .leaflet-container { background:${colors.fill}; }
  .leaflet-control-attribution {
    font-size:12px; line-height:16px; padding:2px 6px;
    margin:0 6px ${attributionBottom}px 6px;
    color:${colors.inkSoft}; background:rgba(255,255,255,0.9); border-radius:6px;
  }
  .leaflet-control-attribution a { color:${colors.inkSoft}; }
</style>
</head>
<body>
<div id="map"></div>
<script src="${LEAFLET_JS}" integrity="${LEAFLET_JS_SRI}" crossorigin="anonymous"></script>
<script>
(function () {
  function post(message) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }
  }
  try {
    if (typeof L === 'undefined') { post({ type: 'error', reason: 'leaflet-missing' }); return; }

    // Gestures live here rather than on the WebView: scrollEnabled is iOS-only,
    // so Leaflet's own handlers are the one cross-platform switch. Freezing a map
    // takes BOTH this and pointerEvents="none" in OsmMap.tsx — either alone leaves
    // it inert, so both must be checked when this behaviour looks wrong.
    var INTERACTIVE = ${interactive ? 'true' : 'false'};
    var HOME = [${lat}, ${lng}];
    var HOME_ZOOM = ${z};

    var options = {
      center: HOME,
      zoom: HOME_ZOOM,
      zoomControl: false,
      attributionControl: false,
      minZoom: INTERACTIVE ? ${INTERACTIVE_MIN_ZOOM} : 3,
      maxZoom: 19,
      dragging: INTERACTIVE,
      touchZoom: INTERACTIVE,
      doubleClickZoom: INTERACTIVE,
      inertia: INTERACTIVE,
      zoomAnimation: INTERACTIVE,
      // Never useful on a phone, and boxZoom/keyboard have no touch equivalent.
      scrollWheelZoom: false, boxZoom: false, keyboard: false,
      // Tile cross-fade only, and it is the animation that janks on budget Android.
      fadeAnimation: false
    };
    if (INTERACTIVE) {
      options.maxBounds = L.latLngBounds([${south}, ${west}], [${north}, ${east}]);
      options.maxBoundsViscosity = 1.0;
    }

    var map = L.map('map', options);

    L.control.attribution({ position: '${attributionPosition}', prefix: '${LEAFLET_ATTRIBUTION}' })
      .addAttribution('${TILE_ATTRIBUTION}')
      .addTo(map);

    // Each of these fires repeatedly once panning is allowed — 'load' on every
    // completed tile batch, 'tileerror' per failed tile. The bridge is level-
    // triggered by design, so latch each signal and post it once.
    var readyPosted = false;
    var errorPosted = false;
    var tileErrors = 0;
    var layer = L.tileLayer('${TILE_URL}', { minZoom: 3, maxZoom: 19 });
    layer.on('tileerror', function () {
      tileErrors++;
      if (tileErrors >= 3 && !errorPosted) { errorPosted = true; post({ type: 'error', reason: 'tile' }); }
    });
    layer.on('load', function () {
      if (readyPosted) return;
      readyPosted = true;
      post({ type: 'ready' });
    });
    layer.addTo(map);
${routeScript}
    var pin = null;
    var HAS_MARKER = ${marker ? 'true' : 'false'};
    var pinIcon = L.divIcon({
      className: '',
      html: '<div style="width:26px;height:26px;border-radius:13px 13px 13px 0;background:${colors.accentBlue};transform:rotate(45deg);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>',
      iconSize: [26, 26],
      iconAnchor: [13, 26],
    });
    if (HAS_MARKER) {
      pin = L.marker([${markerLat}, ${markerLng}], {
        icon: pinIcon,
        draggable: ${markerDraggable ? 'true' : 'false'},
      }).addTo(map);
      pin.on('dragend', function () {
        var pos = pin.getLatLng();
        post({ type: 'marker-moved', latitude: pos.lat, longitude: pos.lng });
      });
${driverMarkerScript}
    }

    var TAP_TO_PLACE = ${tapToPlace ? 'true' : 'false'};
    if (TAP_TO_PLACE) {
      map.on('click', function (e) {
        if (pin) {
          pin.setLatLng(e.latlng);
        } else {
          pin = L.marker(e.latlng, { icon: pinIcon, draggable: true }).addTo(map);
          pin.on('dragend', function () {
            var pos = pin.getLatLng();
            post({ type: 'marker-moved', latitude: pos.lat, longitude: pos.lng });
          });
        }
        post({ type: 'marker-moved', latitude: e.latlng.lat, longitude: e.latlng.lng });
      });
    }

    if (INTERACTIVE) {
      var movedPosted = false;
      var suppress = false;
      var suppressTimer = null;

      function onUserMove() {
        if (suppress || movedPosted) return;
        movedPosted = true;
        post({ type: 'moved' });
      }
      map.on('dragend', onUserMove);
      map.on('zoomend', onUserMove);

      window.__recenter = function () {
        // setView emits the same zoomend/moveend family a real gesture does, so
        // without this the button would instantly re-arm from its own recentre.
        // A timer rather than a moveend listener because a setView that changes
        // nothing emits no event at all, which would strand the flag set.
        suppress = true;
        movedPosted = false;
        if (suppressTimer) clearTimeout(suppressTimer);
        suppressTimer = setTimeout(function () { suppress = false; }, ${RECENTER_SETTLE_MS});
        if (typeof routeLine !== 'undefined' && ROUTE.length >= 2) {
          map.fitBounds(routeLine.getBounds(), { paddingTopLeft: [24, 24], paddingBottomRight: [24, 24 + ${attributionBottom}], animate: true });
        } else {
          map.setView(HOME, HOME_ZOOM, { animate: true });
        }
        post({ type: 'recentered' });
      };
    }

    // Leaflet measures its container on init. Android frequently reports a
    // zero-height viewport on the first frame, which leaves the map initialised
    // with no tiles and no recovery — this is the classic "grey box" failure.
    setTimeout(function () {
      map.invalidateSize();
      if (typeof routeLine !== 'undefined' && ROUTE.length >= 2) {
        map.fitBounds(routeLine.getBounds(), { paddingTopLeft: [24, 24], paddingBottomRight: [24, 24 + ${attributionBottom}] });
      }
    }, 0);
  } catch (e) {
    post({ type: 'error', reason: String((e && e.message) || e) });
  }
})();
</script>
</body>
</html>`;
}
