import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Pressable, Text, View, type DimensionValue } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { colors, motion, spacing } from '../../theme';
import { MapPlaceholder, type MapPlaceholderVariant } from '../MapPlaceholder';
import { styles } from './OsmMap.styles';

/**
 * G2 (Google Maps migration, 2026-09): this used to be a Leaflet map inside a
 * WebView (see git history / mapHtml.ts, now removed) talking to this
 * component over postMessage. It's now a native `react-native-maps` view on
 * `PROVIDER_GOOGLE`. The PUBLIC PROP API is unchanged on purpose — every
 * screen that renders <OsmMap ... /> needed zero changes for this swap.
 *
 * Needs a dev/EAS build; PROVIDER_GOOGLE with a real API key does not work in
 * Expo Go (the key is baked in natively via app.config.js, which a shared
 * pre-built Expo Go binary has no way to pick up).
 */

export const DEFAULT_CENTER = { latitude: 6.116243, longitude: 125.171738 } as const;
export const DEFAULT_ZOOM = 15;

/** If the native map view never reports ready, assume something's badly wrong (not just slow tiles — unlike the old tile-paint signal, onMapReady fires once the native view mounts) and keep the skeleton up. */
const READY_TIMEOUT_MS = 8000;

const RECENTER_DURATION_MS = 350;

const finite = (value: number | undefined, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** Converts the app's existing Leaflet-style zoom levels (3-19) to a region delta, so every call site keeps using the same `zoom` numbers it already passes. */
function zoomToDelta(zoom: number): number {
  return 360 / Math.pow(2, zoom);
}

export interface OsmMapProps {
  /** Drives the fallback skeleton. Markers/routes are a later step. */
  variant?: MapPlaceholderVariant;
  caption?: string;
  /** Keeps `caption` visible after tiles finish loading — for a standing instruction (e.g. "Tap or drag the pin") rather than a loading-state label. */
  captionPersistent?: boolean;
  /** Number or '100%'. Same contract as MapPlaceholder — no parent flex required. */
  height?: DimensionValue;
  latitude?: number;
  longitude?: number;
  zoom?: number;
  /**
   * Was "move OSM's attribution to the opposite corner" — kept for API
   * compatibility, but it's a no-op now. Google's terms of service fix where
   * its logo/attribution sits; an app isn't allowed to relocate or cover it.
   */
  attributionLeft?: boolean;
  /**
   * Pan, pinch/double-tap zoom, and a recenter button. Off by default, and the
   * default is the point: the three preview maps sit inside ScrollViews, where a
   * draggable map competes for the same vertical gesture and wins on Android.
   * Only opt in on full-screen maps that have no scroller to fight.
   */
  interactive?: boolean;
  /**
   * Pixels of the map's bottom edge covered by a native overlay (a driver strip,
   * a sheet). Lifts the recenter button clear of it, and pads route-fitting so
   * the route doesn't end up hidden under the overlay either.
   */
  bottomInset?: number;
  /**
   * Renders a pin at these coordinates. `draggable` lets the rider fine-tune
   * it by hand — drag position is reported via `onMarkerMove`.
   */
  marker?: { latitude: number; longitude: number; draggable?: boolean } | null;
  /** Fixed-marker pin color — navy for a pickup point, green for a destination. Defaults to the navy accent. */
  markerColor?: string;
  onMarkerMove?: (point: { latitude: number; longitude: number }) => void;
  /** Tapping the map drops (or relocates) the marker there. */
  tapToPlace?: boolean;
  /** Draws a suggested route line and frames it. */
  route?: { latitude: number; longitude: number }[] | null;
  /**
   * A second, independently-moving marker (the matched driver's live
   * position) plus a connecting line to the fixed `marker` pin. Requires
   * `marker` to also be set; a no-op otherwise.
   */
  liveDriverMarker?: { latitude: number; longitude: number } | null;
  onReady?: () => void;
  /** Squares off the container corners for maps that run to the screen edges, instead of the default rounded-card look. */
  edgeToEdge?: boolean;
}

type MapState = 'loading' | 'ready' | 'error';

/**
 * Teardrop pin — reproduces the old Leaflet divIcon's shape (a rotated
 * rounded square with a white dot, plus a drop-shadow ellipse) so pickup /
 * destination markers keep the same silhouette after the map engine swap.
 */
function PinMarker({ color }: { color: string }) {
  return (
    <View style={styles.pinWrap} pointerEvents="none">
      <View style={[styles.pinBody, { backgroundColor: color }]}>
        <View style={styles.pinDot} />
      </View>
      <View style={styles.pinShadow} />
    </View>
  );
}

/** Live driver dot — matches the old 22px filled-circle driver icon. */
function DriverDot() {
  return <View style={styles.driverDot} pointerEvents="none" />;
}

/** Route start/end markers — small filled circles, matching the old Leaflet circleMarkers. */
function RouteEndpointDot({ color }: { color: string }) {
  return <View style={[styles.routeDot, { backgroundColor: color }]} pointerEvents="none" />;
}

export function OsmMap({
  variant = 'plain',
  caption,
  captionPersistent = false,
  height = 220,
  latitude = DEFAULT_CENTER.latitude,
  longitude = DEFAULT_CENTER.longitude,
  zoom = DEFAULT_ZOOM,
  interactive = false,
  bottomInset = 0,
  marker = null,
  markerColor = colors.accentGreen,
  onMarkerMove,
  tapToPlace = false,
  route = null,
  liveDriverMarker = null,
  onReady,
  edgeToEdge = false,
}: OsmMapProps) {
  const [state, setState] = useState<MapState>('loading');
  const [hasMoved, setHasMoved] = useState(false);
  const skeletonOpacity = useRef(new Animated.Value(1)).current;
  const recenterOpacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRef = useRef<MapView>(null);

  const lat = finite(latitude, DEFAULT_CENTER.latitude);
  const lng = finite(longitude, DEFAULT_CENTER.longitude);
  const delta = zoomToDelta(Math.min(19, Math.max(3, Math.round(finite(zoom, DEFAULT_ZOOM)))));

  const markerLat = marker ? finite(marker.latitude, lat) : lat;
  const markerLng = marker ? finite(marker.longitude, lng) : lng;
  const markerDraggable = Boolean(marker?.draggable);

  const routeCoords = useMemo(
    () =>
      (route ?? [])
        .map((point) => ({ latitude: finite(point.latitude, NaN), longitude: finite(point.longitude, NaN) }))
        .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)),
    [route],
  );
  const routeKey = useMemo(() => JSON.stringify(routeCoords), [routeCoords]);

  // The initial camera only — an uncontrolled `region` (via `initialRegion`)
  // so the rider's own pan/pinch is never fought by a re-render. Recentering
  // after mount is driven imperatively by the effect below, keyed ONLY on
  // [lat, lng, delta] — deliberately NOT on marker/liveDriverMarker moving,
  // same exclusion the old memoized WebView `source` made and for the same
  // reason: panning to follow every GPS tick would fight the rider's pan.
  const initialRegion = useMemo<Region>(
    () => ({ latitude: lat, longitude: lng, latitudeDelta: delta, longitudeDelta: delta }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally seeded once; see comment above.
    [],
  );

  const settle = useCallback(() => {
    setState((current) => {
      if (current === 'ready') return current;
      Animated.timing(skeletonOpacity, {
        toValue: 0,
        duration: motion.duration.settle,
        easing: motion.easing.out,
        useNativeDriver: true,
      }).start();
      onReady?.();
      return 'ready';
    });
  }, [onReady, skeletonOpacity]);

  const fail = useCallback(() => {
    setState((current) => (current === 'ready' ? current : 'error'));
  }, []);

  useEffect(() => {
    timeoutRef.current = setTimeout(fail, READY_TIMEOUT_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [fail]);

  const handleMapReady = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    settle();
  }, [settle]);

  /** The recenter button earns its place only once there is something to undo. */
  const showRecenter = useCallback(
    (visible: boolean) => {
      setHasMoved(visible);
      Animated.timing(recenterOpacity, {
        toValue: visible ? 1 : 0,
        duration: motion.duration.quick,
        easing: motion.easing.out,
        useNativeDriver: true,
      }).start();
    },
    [recenterOpacity],
  );

  const handleRecenter = useCallback(() => {
    mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: delta, longitudeDelta: delta }, RECENTER_DURATION_MS);
    showRecenter(false);
  }, [lat, lng, delta, showRecenter]);

  const handlePress = useCallback(
    (event: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
      if (!tapToPlace) return;
      onMarkerMove?.(event.nativeEvent.coordinate);
    },
    [tapToPlace, onMarkerMove],
  );

  const handleMarkerDragEnd = useCallback(
    (event: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
      onMarkerMove?.(event.nativeEvent.coordinate);
    },
    [onMarkerMove],
  );

  // Recenter the camera when the map's own "where should this be centered"
  // props change — not on marker/liveDriverMarker movement. See the comment
  // on `initialRegion` above.
  useEffect(() => {
    if (state !== 'ready') return;
    mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: delta, longitudeDelta: delta }, RECENTER_DURATION_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately excludes markerLat/markerLng/liveDriverMarker; see comment above.
  }, [state, lat, lng, delta]);

  // Frame the route whenever it actually changes (not on every render — same
  // discipline as the position-recenter effect above).
  useEffect(() => {
    if (state !== 'ready' || routeCoords.length < 2) return;
    mapRef.current?.fitToCoordinates(routeCoords, {
      edgePadding: { top: 24, left: 24, bottom: 24 + Math.max(0, bottomInset), right: 24 },
      animated: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on routeKey (content), not the array reference.
  }, [state, routeKey, bottomInset]);

  return (
    <View style={[styles.container, { height }, edgeToEdge && styles.edgeToEdge]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        onMapReady={handleMapReady}
        onPress={handlePress}
        onPanDrag={() => showRecenter(true)}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive}
        pointerEvents={interactive ? 'auto' : 'none'}
        toolbarEnabled={false}
        showsMyLocationButton={false}
        showsCompass={false}
      >
        {routeCoords.length >= 2 && (
          <>
            <Polyline coordinates={routeCoords} strokeColor={colors.accentBlue} strokeWidth={5} />
            <Marker coordinate={routeCoords[0]} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <RouteEndpointDot color={colors.accentGreen} />
            </Marker>
            <Marker coordinate={routeCoords[routeCoords.length - 1]} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <RouteEndpointDot color={colors.accentBlue} />
            </Marker>
          </>
        )}

        {marker && (
          <Marker
            coordinate={{ latitude: markerLat, longitude: markerLng }}
            draggable={markerDraggable}
            onDragEnd={handleMarkerDragEnd}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={markerDraggable}
          >
            <PinMarker color={markerColor} />
          </Marker>
        )}

        {marker && liveDriverMarker && (
          <>
            <Polyline
              coordinates={[liveDriverMarker, { latitude: markerLat, longitude: markerLng }]}
              strokeColor={colors.accentGreen}
              strokeWidth={4}
              lineDashPattern={[6, 6]}
            />
            <Marker coordinate={liveDriverMarker} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges>
              <DriverDot />
            </Marker>
          </>
        )}
      </MapView>

      <Animated.View
        style={[styles.skeleton, { opacity: skeletonOpacity }]}
        pointerEvents="none"
      >
        <MapPlaceholder variant={variant} height="100%" />
      </Animated.View>

      {caption && (captionPersistent || state !== 'ready') && (
        <View style={styles.labelChip} pointerEvents="none">
          <Text style={styles.labelText}>{caption}</Text>
        </View>
      )}

      {state === 'error' && (
        <View style={styles.offlineChip} pointerEvents="none">
          <Text style={styles.offlineText}>Offline · showing schematic map</Text>
        </View>
      )}

      {/*
        Last child on purpose — the skeleton covers the full frame, so anything
        that must stay tappable has to sit above it.
      */}
      {interactive && (
        <Animated.View
          style={[
            styles.recenterButton,
            { right: spacing.md },
            { bottom: bottomInset + spacing.md, opacity: recenterOpacity },
          ]}
          pointerEvents={hasMoved ? 'auto' : 'none'}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Recenter map"
            onPress={handleRecenter}
            style={({ pressed }) => [
              styles.recenterPressable,
              pressed && { transform: [{ scale: motion.pressScale }] },
            ]}
          >
            <Ionicons name="locate" size={22} color={colors.ink} />
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}
