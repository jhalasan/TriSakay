import { useEffect, useRef } from 'react';
import {
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState, type AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@trisakay/services/src/supabase/client.ts';
import { colors, fontFamily, PASSENGER_FINISHED_MESSAGE, PASSENGER_STEPS, PASSENGER_WELCOME_BODY, TutorialOverlay, TutorialProvider } from '@trisakay/ui';
import { PASSENGER_TUTORIAL_SEEN_KEY } from '../src/constants/tutorial';
import { useLocationPermission } from '../src/hooks/useLocationPermission';
import { usePassengerTutorialNavigation } from '../src/hooks/usePassengerTutorialNavigation';
import { usePassengerTutorialTrigger } from '../src/hooks/usePassengerTutorialTrigger';
import { useChatNotifications } from '../src/hooks/useChatNotifications';
import { usePushNotificationsSync } from '../src/hooks/usePushNotificationsSync';
import { useAuthStore } from '../src/store/useAuthStore';
import { useBookingStore } from '../src/store/useBookingStore';
import { useConnectivityStore } from '../src/store/useConnectivityStore';
import { useConsentStore, type ConsentGateStatus } from '../src/store/useConsentStore';
import { useNotificationsStore } from '../src/store/useNotificationsStore';
import { resolveActiveRideRoute } from '../src/utils/resolveActiveRideRoute';

/**
 * Anchors the root stack to `index`. Screens declared as <Stack.Screen>
 * children are hoisted ahead of filesystem routes by expo-router's
 * getSortedChildren, so `index` is declared first below as well — without
 * both, the first declared screen becomes the initial route on launch.
 */
export const unstable_settings = { initialRouteName: 'index' };

/**
 * The first path segment of the current route — '(tabs)', 'consent',
 * 'booking', and so on; `undefined` on the index route itself. Both gate
 * effects below decide purely on this, so deriving it once keeps them from
 * drifting into two different notions of "where are we". Returning the string
 * rather than the array also stops the effects re-running on every render,
 * since useSegments() hands back a fresh array each time.
 */
function useRootSegment(): string | undefined {
  const segments = useSegments();
  return segments[0] as string | undefined;
}

/**
 * Routes the location prompt is allowed to appear over: the ordinary app
 * surfaces a rider can be on once both gates have passed.
 *
 * An allowlist, deliberately, not a denylist of gates. The prompt is a
 * transparentModal that pushes itself on top of whatever is showing, and the
 * set of screens it must not cover is open-ended — every gate ('splash',
 * '(auth)', 'consent'), the prompt itself, and every other modal route
 * ('logout' today, more later). A denylist makes each new modal a silent bug
 * the day it is added; this way a route that nobody thought about simply does
 * not get the prompt, which is the safe direction to fail.
 *
 * This is also what keeps the prompt off a gate during the one commit where
 * `segments` still reads the pre-replace route: useProtectedRoute's
 * router.replace() out of '(auth)' or 'consent' lands in the same effect flush
 * as this one (both fire off the same consentStatus transition), so the old
 * root segment is still visible here when this effect runs.
 */
const LOCATION_PROMPT_ROUTES: readonly string[] = ['(tabs)', 'booking', 'profile', 'notifications'];

/**
 * expo-router@6 has no built-in Protected-route API in this SDK, so the
 * auth gate is the manual segment-watching pattern from Expo's own docs:
 * splash owns its own timed redirect, this effect is the safety net for
 * deep links, back-navigation, and logout/login transitions. It gates on
 * two things in order — authentication first, then consent (FR-11.1).
 */
function useProtectedRoute(
  isAuthenticated: boolean,
  consentStatus: ConsentGateStatus,
  accountBlocked: boolean,
  hasActiveTrip: boolean,
) {
  const root = useRootSegment();
  const router = useRouter();

  useEffect(() => {
    const isSplashOrRoot = root === undefined || root === 'splash';
    if (isSplashOrRoot) return;

    // Logout must stay reachable regardless of gate state, or the confirm
    // modal opened from a blocked screen would get bounced back before the
    // rider could confirm it (mirrors the same fix in apps/driver's layout).
    if (root === 'logout') return;

    // Same reasoning as logout above — deactivate-account (UAT P20) is a
    // routed confirm modal, not a real screen with content of its own.
    if (root === 'deactivate-account') return;

    // The first-launch walkthrough and its follow-on landing screen both run
    // before authentication even applies — splash.tsx and walkthrough.tsx are
    // the only things that route here, and they already decide whether this
    // rider needs to see them. Bouncing either to login on every render would
    // make their own router.replace() calls immediately undone by this effect.
    if (root === 'walkthrough' || root === 'landing') return;

    // Verifying the emailed reset code establishes a real session mid-flow
    // (see packages/services/src/auth's verifyPasswordReset), which would
    // otherwise flip isAuthenticated and bounce this screen to Home before
    // the rider has actually set a new password.
    if (root === 'reset-password') return;

    const inAuthGroup = root === '(auth)';
    const onConsent = root === 'consent';
    const onAccountSuspended = root === 'account-suspended';

    if (!isAuthenticated) {
      if (!inAuthGroup) router.replace('/(auth)/login');
      return;
    }

    // Consent is still resolving. Hold position rather than routing on an
    // intermediate status — moving now would flash Home before bouncing to
    // /consent, showing a screen the user is not yet entitled to see.
    if (consentStatus === 'unknown' || consentStatus === 'checking') return;

    if (consentStatus === 'required') {
      if (!onConsent) router.replace('/consent');
      return;
    }

    // P1-25 (2026-09-15 launch audit): mirrors apps/driver's own gate. A
    // suspended/deactivated account is blocked from new activity (RLS
    // enforces this server-side regardless of what the UI does), but an
    // already-active trip stays reachable here too — the rider can still
    // finish it rather than being stranded mid-ride over a PSO action that
    // landed while the trip was underway.
    if (accountBlocked && !hasActiveTrip) {
      if (!onAccountSuspended) router.replace('/account-suspended');
      return;
    }

    // R5 (UAT audit): through splash, not straight to Home. A same-session
    // sign-in (or a suspension lifting) never used to look up whether this
    // account already has an active ride — only a cold app launch did, via
    // splash's own resolveActiveRideRoute() call. Replaying that same check
    // here means signing in on a live app instance restores an in-progress
    // ride exactly like relaunching the app does, instead of dropping the
    // rider on an empty Home while a driver is still en route to them.
    // `fast=1` skips splash's cold-start branding delay — this app instance
    // is already warm, so there's nothing to cover for.
    if (inAuthGroup || onConsent || (onAccountSuspended && (!accountBlocked || hasActiveTrip))) {
      router.replace({ pathname: '/splash', params: { fast: '1' } });
    }
  }, [isAuthenticated, consentStatus, accountBlocked, hasActiveTrip, root, router]);
}

/**
 * R5 (UAT audit): re-syncs with the backend's idea of "does this passenger
 * have a ride right now" on a real background → foreground cycle — not on
 * every render, and not on the 'inactive' blips iOS fires for Notification
 * Center or an incoming call (same `wasBackgrounded` gating idiom as
 * useLocationPermission's own AppState listener).
 *
 * Scoped to `tripStatus === 'idle'`: a ride already tracked locally is kept
 * live by its own screen-level subscription (finding-driver.tsx,
 * trip.tsx) — this only covers the gap those can't: the local store still
 * reading empty while the backend has since assigned a driver, e.g. a push
 * arrived while backgrounded and the realtime channel it would have used
 * had already been torn down for the background state. A rider who only
 * background/foreground-cycles while genuinely idle sees no effect at all.
 */
function useForegroundActiveRideSync(sessionUserId: string | null, consentStatus: ConsentGateStatus) {
  const router = useRouter();
  const wasBackgroundedRef = useRef(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'background') {
        wasBackgroundedRef.current = true;
        return;
      }
      if (nextState !== 'active' || !wasBackgroundedRef.current) return;
      wasBackgroundedRef.current = false;

      if (!sessionUserId || consentStatus !== 'accepted') return;
      if (useBookingStore.getState().tripStatus !== 'idle') return;

      resolveActiveRideRoute(sessionUserId)
        .then((route) => {
          if (!route) return;
          if (route.pathname === '/booking/trip') {
            router.replace({ pathname: '/booking/trip', params: { status: route.status } });
          } else {
            router.replace('/booking/finding-driver');
          }
        })
        .catch(() => {
          // Best-effort resync — a failed lookup leaves the rider exactly
          // where they already were, never worse off.
        });
    });

    return () => subscription.remove();
  }, [sessionUserId, consentStatus, router]);
}

/**
 * Drives the consent check from the auth state rather than from inside
 * useConsentStore, so consent stays decoupled from useAuthStore's internals.
 *
 * Keyed on the session's user id, not on `isAuthenticated`: signing in (or
 * registering) on a client that already holds a session replaces that session
 * and fires SIGNED_IN without the boolean ever passing through false, so a
 * boolean-keyed effect never re-runs and the new user silently inherits the
 * previous user's verdict. `sessionUserId` moves on every auth event, and it
 * moves synchronously — `user?.id` would still read as the previous user for
 * the length of the profile fetch, which is precisely the window that has to
 * be closed.
 *
 * Clearing first matters in both directions: on sign-out so nothing is
 * inherited, and on a switch so reset()'s epoch bump discards any check still
 * in flight for the identity being replaced.
 */
function useConsentSync(sessionUserId: string | null) {
  const check = useConsentStore((state) => state.check);
  const reset = useConsentStore((state) => state.reset);

  useEffect(() => {
    reset();
    if (sessionUserId === null) return;
    void check();
  }, [sessionUserId, check, reset]);
}

/**
 * R5 (UAT audit): useBookingStore otherwise survives a sign-out or an
 * account switch untouched, since nothing keys it to identity — a rider who
 * logs out mid-ride, or who hands the device to someone else who signs in,
 * would leave the previous account's pickup/dropoff/fare/tripStatus visible
 * to whoever is signed in next (and `hasActiveTrip` in RootLayoutNav would
 * wrongly reflect the *previous* user's ride when deciding the new user's
 * account-suspended gate). Same sessionUserId-keyed shape as useConsentSync,
 * for the same reason: it moves synchronously on every auth event, unlike
 * `isAuthenticated`, which stays true across a same-client account switch.
 *
 * Deliberately resets on every change, including into a fresh sign-in — this
 * always runs before splash.tsx's own resolveActiveRideRoute() populates the
 * store for whoever is now signed in (that call is gated behind an await, so
 * it can only run after this synchronous effect), so a legitimate restore is
 * never clobbered by it.
 */
function useBookingStoreReset(sessionUserId: string | null) {
  const reset = useBookingStore((state) => state.reset);

  useEffect(() => {
    reset();
  }, [sessionUserId, reset]);
}

/**
 * Kept subscribed for the whole session, not just while the Notifications
 * screen is mounted — home.tsx's unread-count badge needs items to arrive
 * live regardless of which screen the passenger is on.
 */
function useNotificationsSync(sessionUserId: string | null) {
  const subscribe = useNotificationsStore((state) => state.subscribe);
  const unsubscribe = useNotificationsStore((state) => state.unsubscribe);

  useEffect(() => {
    if (sessionUserId === null) {
      unsubscribe();
      return;
    }
    subscribe(sessionUserId);
  }, [sessionUserId, subscribe, unsubscribe]);
}

/**
 * R7 (existing-system audit): supabase-js's `autoRefreshToken` only actually
 * ticks while something has called `startAutoRefresh()` — the standard React
 * Native caveat from Supabase's own docs. Without stopping it in the
 * background and restarting it in the foreground, a token nearing expiry
 * while the app is backgrounded is never refreshed, so the first API call
 * after returning to foreground can fail with a stale-token 401 instead of
 * a transparent refresh.
 */
function useSupabaseAutoRefresh() {
  useEffect(() => {
    const client = getSupabaseClient();
    if (AppState.currentState === 'active') void client.auth.startAutoRefresh();

    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        void client.auth.startAutoRefresh();
      } else {
        void client.auth.stopAutoRefresh();
      }
    });

    return () => subscription.remove();
  }, []);
}

/**
 * Global connectivity listener — kept subscribed for the whole session (not
 * scoped to a single screen) since the offline strip and tab-bar dimming
 * must persist across every tab, per the redesign's system-states spec.
 */
function useConnectivitySync() {
  const subscribe = useConnectivityStore((state) => state.subscribe);

  useEffect(() => {
    return subscribe();
  }, [subscribe]);
}

/**
 * Surfaces the permission prompt on every foreground while permission is
 * missing. The dismissal flag is cleared by the hook's AppState listener, so
 * "Not now" holds for this session only — FR-11.4 asks for a prompt on app
 * start, not a one-time prompt.
 */
function useLocationPrompt(isAuthenticated: boolean, consentStatus: ConsentGateStatus) {
  const root = useRootSegment();
  const router = useRouter();
  const { state, dismissedThisForeground } = useLocationPermission();

  useEffect(() => {
    // Never prompt over the auth or consent gates — they come first.
    if (!isAuthenticated || consentStatus !== 'accepted') return;
    if (state === 'granted' || state === 'unknown') return;
    if (dismissedThisForeground) return;
    if (root === undefined || !LOCATION_PROMPT_ROUTES.includes(root)) return;

    router.push('/location-permission');
  }, [isAuthenticated, consentStatus, state, dismissedThisForeground, root, router]);
}

/**
 * Mounted as a child of TutorialProvider (not RootLayoutNav itself, which
 * renders the provider) so its hooks can read useTutorial(). Drives
 * auto-start, screen-follows-tour navigation, and the overlay's own render.
 */
function PassengerTutorialMount() {
  const firstName = useAuthStore((state) => state.user?.firstName);
  usePassengerTutorialTrigger();
  usePassengerTutorialNavigation();

  return (
    <TutorialOverlay
      firstName={firstName}
      welcomeBody={PASSENGER_WELCOME_BODY}
      finishedMessage={PASSENGER_FINISHED_MESSAGE}
      logoSource={require('../../../assets/brand/trisakay-mark.png')}
    />
  );
}

function writePassengerTutorialSeen() {
  void AsyncStorage.setItem(PASSENGER_TUTORIAL_SEEN_KEY, new Date().toISOString());
}

export default function RootLayout() {
  // Keyed by the theme's own constants rather than by the imported binding
  // names, so renaming a family in packages/ui cannot silently desync the
  // loader from the tokens that reference it — a family that is not loaded
  // falls back to the system face with no error.
  const [fontsLoaded, fontError] = useFonts({
    [fontFamily.regular]: Poppins_400Regular,
    [fontFamily.semibold]: Poppins_600SemiBold,
    [fontFamily.bold]: Poppins_700Bold,
    [fontFamily.extrabold]: Poppins_800ExtraBold,
  });

  // Hold the tree until the faces resolve, so nothing paints in the system font
  // and then reflows once Inter arrives. `fontError` counts as resolved on
  // purpose: a font that fails to load must degrade to the system face, never
  // strand the app on a blank screen — the same fail-open rule the auth and
  // consent gates already follow.
  if (!fontsLoaded && !fontError) return null;

  return <RootLayoutNav />;
}

/**
 * Split from the font gate above so the navigation effects cannot run before
 * the Stack is mounted. Returning null from a component that had already called
 * useProtectedRoute would let a router.replace() fire with no navigator
 * present, which expo-router treats as an error.
 */
function RootLayoutNav() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const sessionUserId = useAuthStore((state) => state.sessionUserId);
  const consentStatus = useConsentStore((state) => state.status);
  const accountStatus = useAuthStore((state) => state.user?.accountStatus);
  const accountBlocked = accountStatus === 'suspended' || accountStatus === 'deactivated';
  const tripStatus = useBookingStore((state) => state.tripStatus);
  const hasActiveTrip = tripStatus !== 'idle' && tripStatus !== 'rated';
  useSupabaseAutoRefresh();
  useConsentSync(sessionUserId);
  useBookingStoreReset(sessionUserId);
  useNotificationsSync(sessionUserId);
  useConnectivitySync();
  usePushNotificationsSync(sessionUserId);
  useChatNotifications();
  useProtectedRoute(isAuthenticated, consentStatus, accountBlocked, hasActiveTrip);
  useForegroundActiveRideSync(sessionUserId, consentStatus);
  useLocationPrompt(isAuthenticated, consentStatus);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <TutorialProvider steps={PASSENGER_STEPS} onSkip={writePassengerTutorialSeen} onFinish={writePassengerTutorialSeen}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="walkthrough" />
            <Stack.Screen name="landing" />
            <Stack.Screen name="consent" />
            <Stack.Screen name="account-suspended" />
            <Stack.Screen name="reset-password" />
            <Stack.Screen
              name="location-permission"
              options={{ presentation: 'transparentModal', animation: 'fade' }}
            />
            <Stack.Screen
              name="logout"
              options={{ presentation: 'transparentModal', animation: 'fade' }}
            />
            <Stack.Screen
              name="deactivate-account"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
          </Stack>
          <PassengerTutorialMount />
        </TutorialProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
