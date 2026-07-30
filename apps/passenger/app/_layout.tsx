import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@trisakay/ui';
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

export default function RootLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const consentStatus = useConsentStore((state) => state.status);
  useConsentSync(isAuthenticated);
  useProtectedRoute(isAuthenticated, consentStatus);

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
            name="logout"
            options={{ presentation: 'transparentModal', animation: 'fade' }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
