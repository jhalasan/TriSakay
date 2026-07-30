import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { colors } from '@trisakay/ui';
import { useAuthStore } from '../src/store/useAuthStore';
import { useConsentStore, type ConsentGateStatus } from '../src/store/useConsentStore';
import { wait } from '../src/mocks/delay';
import { styles } from './splash.styles';

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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await Promise.all([wait(1400), waitUntilHydrated()]);
      if (cancelled) return;

      if (!useAuthStore.getState().isAuthenticated) {
        router.replace('/(auth)/login');
        return;
      }

      const consentStatus = await waitUntilConsentResolved();
      if (cancelled) return;

      // Re-read auth: the wait above also returns when the session drops (an
      // expired refresh token surfacing mid-check), and a consent verdict is
      // meaningless once there is nobody to apply it to.
      if (!useAuthStore.getState().isAuthenticated) {
        router.replace('/(auth)/login');
        return;
      }

      router.replace(consentStatus === 'accepted' ? '/(tabs)/home' : '/consent');
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../../../assets/brand/trisakay-lockup.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="TriSakay"
      />
      <Text style={styles.subtitle}>Book a tricycle, hassle-free</Text>
      <ActivityIndicator color={colors.accentBlue} style={styles.loader} />
    </View>
  );
}
