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
  onReady?: () => void;
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
  onReady,
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
   * page and throw away the tiles the rider just panned to.
   */
  const source = useMemo(
    () => ({
      html: buildMapHtml({ latitude, longitude, zoom, attributionLeft, interactive, bottomInset }),
    }),
    [latitude, longitude, zoom, attributionLeft, interactive, bottomInset],
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
      }
    },
    [settle, fail, showRecenter],
  );

  const handleRecenter = useCallback(() => {
    webViewRef.current?.injectJavaScript(RECENTER_JS);
  }, []);

  return (
    <View style={[styles.container, { height }]}>
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
