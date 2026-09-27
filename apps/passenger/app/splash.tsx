import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { PopEntrance } from '../src/components/PopEntrance';
import { MapGround } from '../src/components/MapGround';
import { SplashIllustration } from '../src/components/illustrations';
import { useAuthStore } from '../src/store/useAuthStore';
import { useConsentStore, type ConsentGateStatus } from '../src/store/useConsentStore';
import { wait } from '../src/mocks/delay';
import { styles } from '../src/styles/splash.styles';
import { WALKTHROUGH_SEEN_KEY } from '../src/constants/walkthrough';
import { resolveActiveRideRoute } from '../src/utils/resolveActiveRideRoute';

/**
 * The looping indeterminate sweep on the splash loading bar: the indicator
 * grows then shrinks (6% → 62% → 6% of the track) while sliding left-to-right
 * (0% → 94%) over each 1.7s pass, then jumps back to the start — matching
 * the source's `om-load` keyframe rather than a simple back-and-forth slide.
 */
function LoadingBar() {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(reducedMotion ? 0.5 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    progress.value = withDelay(
      900,
      withRepeat(withTiming(1, { duration: 1700, easing: Easing.linear }), -1, false),
    );
  }, [progress, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    const widthPct = interpolate(progress.value, [0, 0.5, 1], [6, 62, 6], Extrapolation.CLAMP);
    const marginLeftPct = interpolate(progress.value, [0, 1], [0, 94], Extrapolation.CLAMP);
    return {
      width: `${widthPct}%`,
      left: `${marginLeftPct}%`,
    };
  });

  return (
    <View style={styles.loadingBar}>
      <Animated.View style={[styles.loadingIndicator, animatedStyle]} />
    </View>
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

/**
 * Resolves once consent is known, or as soon as the session goes away.
 *
 * The second exit is not optional. A check in flight is abandoned if the
 * session it was started for is replaced or lost (useConsentStore drops
 * superseded results, and useConsentSync's reset() puts the status back to
 * 'unknown'), so waiting on a settled status alone would wait for a result
 * that is never coming — with useProtectedRoute disabled on this segment,
 * that is a permanent hang on the splash screen. Losing the session is the
 * only way an in-flight check is abandoned without another one replacing it,
 * so watching for it covers the whole failure mode; every other path settles
 * within the store's own request timeout.
 *
 * Kicks off the check itself when nothing has started one — the root layout
 * normally does, but splash must not depend on that ordering.
 */
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
  // R5 (UAT audit): _layout.tsx routes back here — instead of straight to
  // Home — on a same-session sign-in or account switch, so the active-ride
  // lookup below runs then too, not just on a cold launch. The 1.4s brand
  // beat belongs to a cold start; someone who just tapped "Log in" a second
  // ago should not eat it a second time.
  const { fast } = useLocalSearchParams<{ fast?: string }>();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await Promise.all([fast ? Promise.resolve() : wait(1400), waitUntilHydrated()]);
      if (cancelled) return;

      if (!useAuthStore.getState().isAuthenticated) {
        const walkthroughSeen = await AsyncStorage.getItem(WALKTHROUGH_SEEN_KEY).catch(() => null);
        router.replace(walkthroughSeen ? '/(auth)/login' : '/walkthrough');
        return;
      }

      const consentStatus = await waitUntilConsentResolved();
      if (cancelled) return;

      // Re-read auth: the wait above also returns when the session drops (an
      // expired refresh token surfacing mid-check), and a consent verdict is
      // meaningless once there is nobody to apply it to.
      const sessionUserId = useAuthStore.getState().sessionUserId;
      if (!useAuthStore.getState().isAuthenticated || !sessionUserId) {
        router.replace('/(auth)/login');
        return;
      }

      if (consentStatus !== 'accepted') {
        router.replace('/consent');
        return;
      }

      const activeRideRoute = await resolveActiveRideRoute(sessionUserId);
      if (cancelled) return;

      if (!activeRideRoute) {
        router.replace('/(tabs)/home');
      } else if (activeRideRoute.pathname === '/booking/trip') {
        router.replace({ pathname: '/booking/trip', params: { status: activeRideRoute.status } });
      } else {
        router.replace('/booking/finding-driver');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, fast]);

  return (
    <View style={styles.root}>
      <MapGround style={styles.illustration}>
        <SplashIllustration />
      </MapGround>
      <View style={styles.content} pointerEvents="none">
        <PopEntrance delayMs={350} durationMs={700} style={styles.card}>
          <Image
            source={require('../../../assets/brand/trisakay-lockup.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="TriSakay"
          />
          <Text style={styles.subtitle}>Your ride is just a tap away</Text>
        </PopEntrance>
      </View>
      <LoadingBar />
    </View>
  );
}
