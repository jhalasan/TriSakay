import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Pressable, Text, View, type DimensionValue } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { colors, motion, spacing } from '../../theme';
import { MapPlaceholder, type MapPlaceholderVariant } from '../MapPlaceholder';
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  buildMapHtml,
  type MapMessage,
} from './mapHtml';
import { styles } from './OsmMap.styles';

/**
 * Identifies this app to the OSM tile service. `applicationNameForUserAgent`
 * APPENDS to the platform WebView UA rather than replacing it — a generic
 * library default is blocked without notice under the OSM tile policy, while a
 * bare non-browser UA risks tripping CDN heuristics.
 */
const APP_USER_AGENT = 'TriSakayPassenger/1.0 (+mailto:nexasystems6@gmail.com)';

/** If no tile has painted by now, assume offline and keep the skeleton up. */
const READY_TIMEOUT_MS = 8000;

/** Trailing `true;` is required — iOS misbehaves when the last expression isn't. */
const RECENTER_JS = 'window.__recenter && window.__recenter(); true;';

export interface OsmMapProps {
  /** Drives the fallback skeleton. Markers/routes are a later step. */
  variant?: MapPlaceholderVariant;
  caption?: string;
  /** Number or '100%'. Same contract as MapPlaceholder — no parent flex required. */
  height?: DimensionValue;
  latitude?: number;
  longitude?: number;
  zoom?: number;
  /** Move attribution bottom-left where a bottom overlay would cover it. */
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
   * a sheet). Lifts both the OSM attribution and the recenter button clear of it
   * — the screen owns this number because only it knows what it renders on top.
   */
  bottomInset?: number;
  /**
   * Renders a pin at these coordinates. `draggable` lets the rider fine-tune
   * it by hand — drag position is reported via `onMarkerMove`, not fed back
   * into this prop's own `latitude`/`longitude` for the `source` memo below,
   * so a drag (or a fresher GPS fix) never remounts the WebView and re-fetches
   * every tile.
   */
  marker?: { latitude: number; longitude: number; draggable?: boolean } | null;
  onMarkerMove?: (point: { latitude: number; longitude: number }) => void;
  /** Tapping the map drops (or relocates) the marker there. See `mapHtml.ts`'s doc for why this defaults off. */
  tapToPlace?: boolean;
  /** Draws a suggested route line and frames it. See mapHtml's `route` option. */
  route?: { latitude: number; longitude: number }[] | null;
  onReady?: () => void;
  /** Squares off the container corners for maps that run to the screen edges, instead of the default rounded-card look. */
  edgeToEdge?: boolean;
}

type MapState = 'loading' | 'ready' | 'error';

export function OsmMap({
  variant = 'plain',
  caption,
  height = 220,
  latitude = DEFAULT_CENTER.latitude,
  longitude = DEFAULT_CENTER.longitude,
  zoom = DEFAULT_ZOOM,
  attributionLeft = false,
  interactive = false,
  bottomInset = 0,
  marker = null,
  onMarkerMove,
  tapToPlace = false,
  route = null,
  onReady,
  edgeToEdge = false,
}: OsmMapProps) {
  const [state, setState] = useState<MapState>('loading');
  const [hasMoved, setHasMoved] = useState(false);
  const skeletonOpacity = useRef(new Animated.Value(1)).current;
  const recenterOpacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webViewRef = useRef<WebView>(null);
  /**
   * Memoized: a fresh object literal each render remounts the WebView and
   * re-fetches every tile. Several screens re-render from store subscriptions
   * and animation ticks, and reload storms are exactly what the OSM tile policy
   * blocks for.
   *
   * Every dependency here is constant for a given screen. `hasMoved` is
   * deliberately NOT one — showing the recenter button must never rebuild the
   * page and throw away the tiles the rider just panned to. `marker`'s own
   * coordinates are excluded the same way: once a drag or a tap moves it,
   * Leaflet has already updated the pin on-screen without any React
   * involvement, so re-embedding that same position in the HTML would only
   * force a needless reload. The callback still reads the *current* `marker`
   * value (via closure, not a stale snapshot) whenever it reruns for another
   * reason — e.g. `latitude`/`longitude` changing because the rider picked a
   * different search result — so that remount still places the pin correctly.
   */
  const source = useMemo(
    () => ({
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
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- marker's coordinates are deliberately excluded; see the comment above. `route` is serialized via JSON.stringify so an equal-but-new array reference (a common shape from a fresh fetch/selector) doesn't force a remount — only a change in the actual points does. The route resolving asynchronously after mount therefore causes exactly one remount, same as a lat/lng change.
    [latitude, longitude, zoom, attributionLeft, interactive, bottomInset, Boolean(marker), marker?.draggable, tapToPlace, JSON.stringify(route ?? null)],
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

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let message: MapMessage;
      try {
        message = JSON.parse(event.nativeEvent.data) as MapMessage;
      } catch {
        return;
      }
      if (message.type === 'ready') {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        settle();
      } else if (message.type === 'error') {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (__DEV__) console.warn(`[OsmMap] ${message.reason}`);
        fail();
      } else if (message.type === 'moved') {
        showRecenter(true);
      } else if (message.type === 'recentered') {
        showRecenter(false);
      } else if (message.type === 'marker-moved') {
        onMarkerMove?.({ latitude: message.latitude, longitude: message.longitude });
      }
    },
    [settle, fail, showRecenter, onMarkerMove],
  );

  const handleRecenter = useCallback(() => {
    webViewRef.current?.injectJavaScript(RECENTER_JS);
  }, []);

  return (
    <View style={[styles.container, { height }, edgeToEdge && styles.edgeToEdge]}>
      <WebView
        ref={webViewRef}
        style={styles.webview}
        source={source}
        originWhitelist={['*']}
        applicationNameForUserAgent={APP_USER_AGENT}
        javaScriptEnabled
        domStorageEnabled={false}
        // Left true on purpose: the OSM policy requires honouring cache headers.
        cacheEnabled
        setBuiltInZoomControls={false}
        setDisplayZoomControls={false}
        overScrollMode="never"
        scrollEnabled={false}
        bounces={false}
        androidLayerType="hardware"
        // Half of the freeze — Leaflet's own handlers in mapHtml.ts are the other
        // half. Kept off by default so a map inside a ScrollView cannot swallow
        // the vertical drag that belongs to the scroller.
        pointerEvents={interactive ? 'auto' : 'none'}
        onMessage={handleMessage}
        // These only fire for main-document failures — with source={{html}} the
        // document always loads, so they never catch a dead CDN or failed tiles.
        // Real detection is onMessage + the timeout above; these are a bonus.
        onError={fail}
        onHttpError={fail}
      />

      <Animated.View
        style={[styles.skeleton, { opacity: skeletonOpacity }]}
        pointerEvents="none"
      >
        <MapPlaceholder variant={variant} height="100%" />
      </Animated.View>

      {caption && state !== 'ready' && (
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
        that must stay tappable has to sit above it. Placed opposite the OSM
        attribution and lifted by bottomInset so neither control nor credit lands
        under whatever the screen renders along its bottom edge.
      */}
      {interactive && (
        <Animated.View
          style={[
            styles.recenterButton,
            attributionLeft ? { right: spacing.md } : { left: spacing.md },
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
