import { useEffect } from 'react';
import {
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors, fontFamily } from '@trisakay/ui';
import { useLocationPermission } from '../src/hooks/useLocationPermission';
import { useAuthStore } from '../src/store/useAuthStore';
import { useConsentStore, type ConsentGateStatus } from '../src/store/useConsentStore';

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
function useProtectedRoute(isAuthenticated: boolean, consentStatus: ConsentGateStatus) {
  const root = useRootSegment();
  const router = useRouter();

  useEffect(() => {
    const isSplashOrRoot = root === undefined || root === 'splash';
    if (isSplashOrRoot) return;

    // Logout must stay reachable regardless of gate state, or the confirm
    // modal opened from a blocked screen would get bounced back before the
    // rider could confirm it (mirrors the same fix in apps/driver's layout).
    if (root === 'logout') return;

    const inAuthGroup = root === '(auth)';
    const onConsent = root === 'consent';

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
    } else if (inAuthGroup || onConsent) {
      router.replace('/(tabs)/home');
    }
  }, [isAuthenticated, consentStatus, root, router]);
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
  useConsentSync(sessionUserId);
  useProtectedRoute(isAuthenticated, consentStatus);
  useLocationPrompt(isAuthenticated, consentStatus);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="consent" />
          <Stack.Screen
            name="location-permission"
            options={{ presentation: 'transparentModal', animation: 'fade' }}
          />
          <Stack.Screen
            name="logout"
            options={{ presentation: 'transparentModal', animation: 'fade' }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
