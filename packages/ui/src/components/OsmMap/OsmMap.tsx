import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Pressable, Text, View, type DimensionValue } from 'react-native';
import ReAnimated, {
  Easing as ReanimatedEasing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
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

/** Navigation ("follow") camera: close in, tilted, rotated to the direction of travel. */
const FOLLOW_ZOOM = 17;
const FOLLOW_PITCH = 40;
const FOLLOW_DURATION_MS = 900;

/**
 * Reanimated's own Easing — the shared `motion.easing` token is built from core
 * react-native's Easing and is not worklet-safe (see the note on that token, and
 * MapOverlaySheet). Same curve as motion.easing.out, sourced compatibly.
 */
const RECENTER_EASING = ReanimatedEasing.bezier(0.16, 1, 0.3, 1);

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
   * A live, animated counterpart to `bottomInset` for the recenter button only
   * — pass a bottom sheet's current height (see MapOverlaySheet's `heightValue`)
   * and the button tracks it frame-by-frame as the sheet is dragged, instead of
   * stranding itself mid-map once the sheet collapses.
   *
   * Deliberately does NOT drive route edge-padding the way the static
   * `bottomInset` does: re-framing the camera on every frame of a drag would
   * fight the rider for control of the map. Pass both — the static one sizes
   * the route fit to the sheet's expanded height, this one moves the button.
   */
  bottomInsetValue?: SharedValue<number>;
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
  /**
   * Navigation mode: the camera follows this position, tilted and rotated to
   * `heading` (degrees, 0 = north), and it is drawn as a direction arrow. The
   * route is drawn as a trimmed road line with no start dot, and the map is
   * not re-framed to fit it. Panning the map pauses following until the
   * recenter button is pressed.
   */
  followPosition?: { latitude: number; longitude: number; heading?: number | null } | null;
  /** Camera zoom in navigation mode. Defaults to a close-in driver's view. */
  followZoom?: number;
  /** Camera tilt in degrees in navigation mode; 0 is straight down. */
  followPitch?: number;
  onReady?: () => void;
  /** Squares off the container corners for maps that run to the screen edges, instead of the default rounded-card look. */
  edgeToEdge?: boolean;
}

type MapState = 'loading' | 'ready' | 'error';

/**
 * Pin — a circular head with a white dot, a triangular point, and a
 * drop-shadow ellipse. See the `pinHead`/`pinPoint` comment in
 * OsmMap.styles.ts for why this avoids `transform: rotate`.
 */
function PinMarker({ color }: { color: string }) {
  return (
    <View style={styles.pinWrap} pointerEvents="none">
      <View style={[styles.pinHead, { backgroundColor: color }]}>
        <View style={styles.pinDot} />
      </View>
      <View style={[styles.pinPoint, { borderTopColor: color }]} />
      <View style={styles.pinShadow} />
    </View>
  );
}

/** Live driver dot — matches the old 22px filled-circle driver icon. */
function DriverDot() {
  return <View style={styles.driverDot} pointerEvents="none" />;
}

/** Driver arrow for navigation mode — points up; the marker itself is rotated to the heading. */
function NavArrow() {
  return (
    <View style={styles.navArrow} pointerEvents="none">
      <View style={styles.navArrowTip} />
    </View>
  );
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
  bottomInsetValue,
  marker = null,
  markerColor = colors.accentGreen,
  onMarkerMove,
  tapToPlace = false,
  route = null,
  liveDriverMarker = null,
  followPosition = null,
  followZoom = FOLLOW_ZOOM,
  followPitch = FOLLOW_PITCH,
  onReady,
  edgeToEdge = false,
}: OsmMapProps) {
  const [state, setState] = useState<MapState>('loading');
  const [hasMoved, setHasMoved] = useState(false);
  // Navigation mode only: false once the rider pans away, until they press recenter.
  const [following, setFollowing] = useState(true);
  const skeletonOpacity = useRef(new Animated.Value(1)).current;
  // Reanimated, unlike the skeleton's core-RN Animated above, so this one style
  // can carry both the fade and a `bottom` that tracks `bottomInsetValue` on the
  // UI thread — a sheet-following button can't re-render per frame.
  const recenterOpacity = useSharedValue(0);
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
      recenterOpacity.value = withTiming(visible ? 1 : 0, {
        duration: motion.duration.quick,
        easing: RECENTER_EASING,
      });
    },
    [recenterOpacity],
  );

  // `bottomInsetValue` wins when supplied so the button rides a sheet's live
  // height; `bottomInset` is the static fallback every other call site uses.
  const recenterAnimatedStyle = useAnimatedStyle(() => ({
    opacity: recenterOpacity.value,
    bottom: (bottomInsetValue ? bottomInsetValue.value : bottomInset) + spacing.md,
  }));

  const handleRecenter = useCallback(() => {
    if (followPosition) {
      setFollowing(true);
      showRecenter(false);
      return;
    }
    mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: delta, longitudeDelta: delta }, RECENTER_DURATION_MS);
    showRecenter(false);
  }, [lat, lng, delta, showRecenter, followPosition]);

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
    if (state !== 'ready' || followPosition) return;
    mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: delta, longitudeDelta: delta }, RECENTER_DURATION_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately excludes markerLat/markerLng/liveDriverMarker; see comment above.
  }, [state, lat, lng, delta]);

  // Frame the route whenever it actually changes (not on every render — same
  // discipline as the position-recenter effect above).
  useEffect(() => {
    if (state !== 'ready' || routeCoords.length < 2 || followPosition) return;
    mapRef.current?.fitToCoordinates(routeCoords, {
      edgePadding: { top: 24, left: 24, bottom: 24 + Math.max(0, bottomInset), right: 24 },
      animated: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on routeKey (content), not the array reference.
  }, [state, routeKey, bottomInset]);

  // Navigation camera: glide to each new fix, rotated to the heading. With no
  // heading yet (not moving) the current rotation is kept.
  const followLat = followPosition ? finite(followPosition.latitude, NaN) : NaN;
  const followLng = followPosition ? finite(followPosition.longitude, NaN) : NaN;
  const followHeading = typeof followPosition?.heading === 'number' ? followPosition.heading : undefined;
  useEffect(() => {
    if (state !== 'ready' || !following || !Number.isFinite(followLat) || !Number.isFinite(followLng)) return;
    mapRef.current?.animateCamera(
      { center: { latitude: followLat, longitude: followLng }, heading: followHeading, pitch: followPitch, zoom: followZoom },
      { duration: FOLLOW_DURATION_MS },
    );
  }, [state, following, followLat, followLng, followHeading, followZoom, followPitch]);

  return (
    <View style={[styles.container, { height }, edgeToEdge && styles.edgeToEdge]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        onMapReady={handleMapReady}
        onPress={handlePress}
        onPanDrag={() => {
          if (followPosition) setFollowing(false);
          showRecenter(true);
        }}
        // Navigation mode: shift the camera centre up so the arrow sits in the visible map, above the bottom sheet.
        mapPadding={followPosition ? { top: 0, left: 0, right: 0, bottom: Math.max(0, bottomInset) } : undefined}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive}
        pointerEvents={interactive ? 'auto' : 'none'}
        toolbarEnabled={false}
        showsMyLocationButton={false}
        showsCompass={false}
      >
        {routeCoords.length >= 2 && followPosition && (
          // White casing under the blue line, the way navigation apps draw it.
          <>
            <Polyline coordinates={routeCoords} strokeColor="#FFFFFF" strokeWidth={10} zIndex={1} />
            <Polyline coordinates={routeCoords} strokeColor={colors.accentBlue} strokeWidth={6} zIndex={2} />
          </>
        )}

        {routeCoords.length >= 2 && !followPosition && (
          <>
            <Polyline coordinates={routeCoords} strokeColor={colors.accentBlue} strokeWidth={5} />
            {/*
              tracksViewChanges={true} here, not false — react-native-maps on
              Android can snapshot a custom marker's content before it has
              actually painted a first frame, caching a blank bitmap forever
              once tracksViewChanges is false (confirmed: these dots weren't
              rendering at all in UAT). Leaving it true forces a fresh
              snapshot each render, which is cheap for two static dots.
            */}
            <Marker coordinate={routeCoords[0]} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges>
              <RouteEndpointDot color={colors.accentGreen} />
            </Marker>
            <Marker coordinate={routeCoords[routeCoords.length - 1]} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges>
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
            // Same fix as the route-endpoint dots above — was
            // `markerDraggable` (false for most call sites), which risked
            // caching a blank first snapshot on Android.
            tracksViewChanges
          >
            <PinMarker color={markerColor} />
          </Marker>
        )}

        {followPosition && Number.isFinite(followLat) && Number.isFinite(followLng) && (
          <Marker
            coordinate={{ latitude: followLat, longitude: followLng }}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={followHeading ?? 0}
            flat
            zIndex={3}
            tracksViewChanges
          >
            <NavArrow />
          </Marker>
        )}

        {marker && liveDriverMarker && (
          <>
            {/* With a road route drawn, the straight dashed guide line would just cross the buildings. */}
            {routeCoords.length < 2 && (
            <Polyline
              coordinates={[liveDriverMarker, { latitude: markerLat, longitude: markerLng }]}
              strokeColor={colors.accentGreen}
              strokeWidth={4}
              lineDashPattern={[6, 6]}
            />
            )}
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
        <ReAnimated.View
          style={[styles.recenterButton, { right: spacing.md }, recenterAnimatedStyle]}
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
        </ReAnimated.View>
      )}
    </View>
  );
}
