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
import { useDriverStore } from '../src/store/useDriverStore';
import { useNotificationsStore } from '../src/store/useNotificationsStore';
import { useRequestsStore } from '../src/store/useRequestsStore';
import { useTripStore } from '../src/store/useTripStore';
import { useVerificationStore, type VerificationGateStatus } from '../src/store/useVerificationStore';

export const unstable_settings = { initialRouteName: 'index' };

function useRootSegment(): string | undefined {
  const segments = useSegments();
  return segments[0] as string | undefined;
}

const LOCATION_PROMPT_ROUTES: readonly string[] = ['(tabs)', 'trip', 'profile', 'complaints', 'notifications'];

function useProtectedRoute(
  isAuthenticated: boolean,
  consentStatus: ConsentGateStatus,
  verificationStatus: VerificationGateStatus,
  accountBlocked: boolean,
  hasActiveTrip: boolean
) {
  const root = useRootSegment();
  const router = useRouter();

  useEffect(() => {
    const isSplashOrRoot = root === undefined || root === 'splash';
    if (isSplashOrRoot) return;

    // Logout must stay reachable regardless of gate state, or the confirm
    // modal opened from a blocked screen (consent, verification-pending)
    // would get bounced back before the driver could confirm it.
    if (root === 'logout') return;

    const inAuthGroup = root === '(auth)';
    const onConsent = root === 'consent';
    const onVerification = root === 'verification-pending';
    const onAccountSuspended = root === 'account-suspended';

    if (!isAuthenticated) {
      if (!inAuthGroup) router.replace('/(auth)/login');
      return;
    }

    if (consentStatus === 'unknown' || consentStatus === 'checking') return;

    if (consentStatus === 'required') {
      if (!onConsent) router.replace('/consent');
      return;
    }

    // Consent is accepted from here on — a driver still can't reach the app
    // until PSO has approved their verification in person (FR-1.5-1.6).
    if (verificationStatus === 'unknown' || verificationStatus === 'checking') return;

    if (verificationStatus !== 'approved') {
      if (!onVerification) router.replace('/verification-pending');
      return;
    }

    // A suspended/deactivated account is blocked from new activity (RLS
    // enforces this server-side regardless of what the UI does), but an
    // already-active trip stays reachable here too — the driver can still
    // finish it and the passenger isn't stranded mid-ride over a PSO action
    // that landed while the trip was underway.
    if (accountBlocked && !hasActiveTrip) {
      if (!onAccountSuspended) router.replace('/account-suspended');
      return;
    }

    if (inAuthGroup || onConsent || onVerification || (onAccountSuspended && (!accountBlocked || hasActiveTrip))) {
      router.replace('/(tabs)/dashboard');
    }
  }, [isAuthenticated, consentStatus, verificationStatus, accountBlocked, hasActiveTrip, root, router]);
}

function useConsentSync(sessionUserId: string | null) {
  const check = useConsentStore((state) => state.check);
  const reset = useConsentStore((state) => state.reset);

  useEffect(() => {
    reset();
    if (sessionUserId === null) return;
    void check();
  }, [sessionUserId, check, reset]);
}

function useVerificationSync(sessionUserId: string | null) {
  const check = useVerificationStore((state) => state.check);
  const reset = useVerificationStore((state) => state.reset);

  useEffect(() => {
    reset();
    if (sessionUserId === null) return;
    void check();
  }, [sessionUserId, check, reset]);
}

function useAvailabilitySync(sessionUserId: string | null) {
  const checkAvailability = useDriverStore((state) => state.checkAvailability);

  useEffect(() => {
    if (sessionUserId === null) {
      // Covers a session ending without going through app/logout.tsx (e.g.
      // token expiry) — that screen already handles the normal path itself.
      useDriverStore.setState({ isAvailable: false });
      useRequestsStore.getState().unsubscribe();
      return;
    }
    void checkAvailability();
  }, [sessionUserId, checkAvailability]);
}

function useRatingSync(sessionUserId: string | null) {
  const checkRating = useDriverStore((state) => state.checkRating);

  useEffect(() => {
    if (sessionUserId === null) {
      useDriverStore.setState({ rating: null, ratingCount: 0 });
      return;
    }
    void checkRating();
  }, [sessionUserId, checkRating]);
}

/**
 * Rehydrates useTripStore.current from the backend on boot/login, and clears
 * it on logout/session change — without the reset half, a new driver signing
 * in on the same device could otherwise inherit the previous driver's
 * in-progress trip (stale `current` from before the session changed).
 */
function useTripSync(sessionUserId: string | null) {
  const hydrate = useTripStore((state) => state.hydrate);
  const reset = useTripStore((state) => state.reset);

  useEffect(() => {
    if (sessionUserId === null) {
      reset();
      return;
    }
    void hydrate();
  }, [sessionUserId, hydrate, reset]);
}

/**
 * Kept subscribed for the whole session, not just while the Notifications
 * screen is mounted — Dashboard's bell icon shows the unread count too, so
 * items need to arrive live regardless of which screen the driver is on.
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

function useLocationPrompt(isAuthenticated: boolean, consentStatus: ConsentGateStatus) {
  const root = useRootSegment();
  const router = useRouter();
  const { state, dismissedThisForeground } = useLocationPermission();

  useEffect(() => {
    if (!isAuthenticated || consentStatus !== 'accepted') return;
    if (state === 'granted' || state === 'unknown') return;
    if (dismissedThisForeground) return;
    if (root === undefined || !LOCATION_PROMPT_ROUTES.includes(root)) return;

    router.push('/location-permission');
  }, [isAuthenticated, consentStatus, state, dismissedThisForeground, root, router]);
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    [fontFamily.regular]: Poppins_400Regular,
    [fontFamily.semibold]: Poppins_600SemiBold,
    [fontFamily.bold]: Poppins_700Bold,
    [fontFamily.extrabold]: Poppins_800ExtraBold,
  });

  if (!fontsLoaded && !fontError) return null;

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const sessionUserId = useAuthStore((state) => state.sessionUserId);
  const accountStatus = useAuthStore((state) => state.user?.accountStatus);
  const accountBlocked = accountStatus === 'suspended' || accountStatus === 'deactivated';
  const hasActiveTrip = useTripStore((state) => state.current !== null);
  const consentStatus = useConsentStore((state) => state.status);
  const verificationStatus = useVerificationStore((state) => state.status);
  useConsentSync(sessionUserId);
  useVerificationSync(sessionUserId);
  useAvailabilitySync(sessionUserId);
  useRatingSync(sessionUserId);
  useTripSync(sessionUserId);
  useNotificationsSync(sessionUserId);
  useProtectedRoute(isAuthenticated, consentStatus, verificationStatus, accountBlocked, hasActiveTrip);
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
          <Stack.Screen name="verification-pending" />
          <Stack.Screen name="account-suspended" />
          <Stack.Screen name="location-permission" options={{ presentation: 'transparentModal', animation: 'fade' }} />
          <Stack.Screen name="logout" options={{ presentation: 'transparentModal', animation: 'fade' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
