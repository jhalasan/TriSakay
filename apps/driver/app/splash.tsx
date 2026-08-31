import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Image, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { MapGround, MapPin, RoadBand, RoutePath, useMapScale } from '../src/components/MapGround';
import { PopEntrance } from '../src/components/PopEntrance';
import { useTranslation } from '../src/hooks/useTranslation';
import { useAuthStore } from '../src/store/useAuthStore';
import { useConsentStore, type ConsentGateStatus } from '../src/store/useConsentStore';
import { wait } from '../src/mocks/delay';
import { styles } from '../src/styles/splash.styles';

/**
 * The 84px halo behind the driver marker: scale .7 → 1.9, opacity .55 → 0,
 * looping. Not `PulseRing` (packages/ui) — that component's start scale
 * (.9), easing, and lack of a start delay don't match this handoff's timing,
 * and it isn't worth generalizing for one screen.
 */
function Halo() {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    progress.value = withDelay(
      1250,
      withRepeat(withTiming(1, { duration: 2200, easing: Easing.bezier(0.3, 0, 0.5, 1) }), -1, false),
    );
  }, [progress, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    if (reducedMotion) return { transform: [{ scale: 1 }], opacity: 0.3 };
    const s = interpolate(progress.value, [0, 1], [0.7, 1.9], Extrapolation.CLAMP);
    const opacity = interpolate(progress.value, [0, 1], [0.55, 0], Extrapolation.CLAMP);
    return { transform: [{ scale: s }], opacity };
  });

  return <Animated.View style={[styles.halo, animatedStyle]} />;
}

export interface DriverMarkerProps {
  /** Baseline-px center position — the route's endpoint on the driver's side. */
  x: number;
  y: number;
}

/** White circle marking the driver's own position on the route, holding the trike icon. Pops in via PopEntrance. */
function DriverMarker({ x, y }: DriverMarkerProps) {
  const scale = useMapScale();
  const size = scale(64);

  return (
    <View style={[styles.markerHost, { left: scale(x) - size / 2, top: scale(y) - size / 2 }]}>
      <PopEntrance delayMs={1200} durationMs={600} style={styles.markerShadowWrap}>
        <Halo />
        <View style={styles.marker}>
          <Image
            source={require('../assets/trike-icon.png')}
            style={styles.markerIcon}
            resizeMode="contain"
            accessibilityLabel=""
          />
        </View>
      </PopEntrance>
    </View>
  );
}

/**
 * The looping indeterminate sweep on the splash loading bar: the indicator
 * grows then shrinks (6% → 62% → 6% of the track) while sliding left-to-right
 * (0% → 94%) over each 1.7s pass, then jumps back to the start.
 */
function LoadingBar() {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    progress.value = withDelay(
      900,
      withRepeat(withTiming(1, { duration: 1700, easing: Easing.bezier(0.5, 0, 0.5, 1) }), -1, false),
    );
  }, [progress, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    if (reducedMotion) return { width: '44%', left: '0%' };
    const widthPct = interpolate(progress.value, [0, 0.5, 1], [6, 62, 6], Extrapolation.CLAMP);
    const leftPct = interpolate(progress.value, [0, 1], [0, 94], Extrapolation.CLAMP);
    return { width: `${widthPct}%`, left: `${leftPct}%` };
  });

  return (
    <View style={styles.loadingBar}>
      <Animated.View style={[styles.loadingIndicator, animatedStyle]} />
    </View>
  );
}

/** The route + destination pin + driver marker layered over the map ground — reversed from the passenger splash: the line draws from the destination toward the driver. */
function DriverSplashIllustration() {
  return (
    <>
      <RoadBand left={96} width={16} top={0} bottom={0} />
      <RoadBand top={236} height={22} left={0} right={0} />
      <RoadBand bottom={198} height={14} left={0} right={0} />
      <RoutePath points={[{ x: 300, y: 246 }, { x: 104, y: 246 }, { x: 104, y: 700 }]} durationMs={1150} delayMs={150} />
      <MapPin x={300} y={246} tone="navy" delayMs={100} />
      <DriverMarker x={104} y={700} />
    </>
  );
}

function waitUntilHydrated(): Promise<void> {
  if (!useAuthStore.getState().isHydrating) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = useAuthStore.subscribe((state) => {
      if (!state.isHydrating) {
        unsubscribe();
        resolve();
      }
    });
  });
}

function waitUntilConsentResolved(): Promise<ConsentGateStatus> {
  const isSettled = (status: ConsentGateStatus) => status === 'accepted' || status === 'required';
  const hasSession = () => useAuthStore.getState().sessionUserId !== null;

  const current = useConsentStore.getState().status;
  if (isSettled(current) || !hasSession()) return Promise.resolve(current);
  if (current === 'unknown') void useConsentStore.getState().check();

  return new Promise((resolve) => {
    let done = false;
    const settle = (status: ConsentGateStatus) => {
      if (done) return;
      done = true;
      unsubscribeConsent();
      unsubscribeAuth();
      resolve(status);
    };

    const unsubscribeConsent = useConsentStore.subscribe((state) => {
      if (isSettled(state.status)) settle(state.status);
    });
    const unsubscribeAuth = useAuthStore.subscribe((state) => {
      if (state.sessionUserId === null) settle(useConsentStore.getState().status);
    });
  });
}

export default function SplashScreen() {
  const router = useRouter();
  const t = useTranslation();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await Promise.all([wait(2000), waitUntilHydrated()]);
      if (cancelled) return;

      if (!useAuthStore.getState().isAuthenticated) {
        router.replace('/(auth)/login');
        return;
      }

      const consentStatus = await waitUntilConsentResolved();
      if (cancelled) return;

      if (!useAuthStore.getState().isAuthenticated) {
        router.replace('/(auth)/login');
        return;
      }

      router.replace(consentStatus === 'accepted' ? '/(tabs)/dashboard' : '/consent');
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View style={styles.root}>
      <MapGround style={styles.illustration}>
        <DriverSplashIllustration />
      </MapGround>
      <View style={styles.content} pointerEvents="none">
        <PopEntrance style={styles.card}>
          <Image
            source={require('../../../assets/brand/trisakay-lockup.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="TriSakay"
          />
          <View style={styles.driverBadge}>
            <Text style={styles.driverBadgeText}>{t.driver.splash.driverBadge}</Text>
          </View>
          <Text style={styles.tagline}>{t.driver.splash.subtitle}</Text>
        </PopEntrance>
      </View>
      <LoadingBar />
    </View>
  );
}
