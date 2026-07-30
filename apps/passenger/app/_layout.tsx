import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@trisakay/ui';
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
 * expo-router@6 has no built-in Protected-route API in this SDK, so the
 * auth gate is the manual segment-watching pattern from Expo's own docs:
 * splash owns its own timed redirect, this effect is the safety net for
 * deep links, back-navigation, and logout/login transitions. It gates on
 * two things in order — authentication first, then consent (FR-11.1).
 */
function useProtectedRoute(isAuthenticated: boolean, consentStatus: ConsentGateStatus) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const root = segments[0] as string | undefined;
    const isSplashOrRoot = root === undefined || root === 'splash';
    if (isSplashOrRoot) return;

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
  }, [isAuthenticated, consentStatus, segments, router]);
}

/**
 * Drives the consent check from the auth state rather than from inside
 * useConsentStore, so consent stays decoupled from useAuthStore's internals.
 * Resetting on sign-out matters: without it a second user signing in on the
 * same device would inherit the first user's `accepted`.
 */
function useConsentSync(isAuthenticated: boolean) {
  const check = useConsentStore((state) => state.check);
  const reset = useConsentStore((state) => state.reset);

  useEffect(() => {
    if (!isAuthenticated) {
      reset();
      return;
    }
    // Read through getState so an already-running check is not restarted on
    // every re-render.
    if (useConsentStore.getState().status === 'unknown') void check();
  }, [isAuthenticated, check, reset]);
}

/**
 * Surfaces the permission prompt on every foreground while permission is
 * missing. The dismissal flag is cleared by the hook's AppState listener, so
 * "Not now" holds for this session only — FR-11.4 asks for a prompt on app
 * start, not a one-time prompt.
 */
function useLocationPrompt(isAuthenticated: boolean, consentStatus: ConsentGateStatus) {
  const segments = useSegments();
  const router = useRouter();
  const { state, dismissedThisForeground } = useLocationPermission();

  useEffect(() => {
    // Never prompt over the auth or consent gates — they come first.
    if (!isAuthenticated || consentStatus !== 'accepted') return;
    if (state === 'granted' || state === 'unknown') return;
    if (dismissedThisForeground) return;

    // Excludes '(auth)' and 'consent' in addition to the terminal/self cases:
    // useProtectedRoute's router.replace() out of those routes lands in the
    // same effect-flush as this one (both fire off the same consentStatus
    // transition), so `segments` here can still read the pre-replace route
    // for one commit. Without this exclusion this effect would push
    // /location-permission on top of /consent or /(auth)/login before the
    // replace has taken effect, stranding the prompt over a screen the user
    // is not entitled to be on yet.
    const root = segments[0] as string | undefined;
    const isGateOrSelf =
      root === undefined ||
      root === 'splash' ||
      root === '(auth)' ||
      root === 'consent' ||
      root === 'location-permission';
    if (isGateOrSelf) return;

    router.push('/location-permission');
  }, [isAuthenticated, consentStatus, state, dismissedThisForeground, segments, router]);
}

export default function RootLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const consentStatus = useConsentStore((state) => state.status);
  useConsentSync(isAuthenticated);
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
