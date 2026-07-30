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
 * Resolves once consent is known. Kicks off the check itself when nothing has
 * started one — the root layout normally does, but splash must not depend on
 * that ordering or it could wait forever.
 */
function waitUntilConsentResolved(): Promise<ConsentGateStatus> {
  const isSettled = (status: ConsentGateStatus) => status === 'accepted' || status === 'required';

  const current = useConsentStore.getState().status;
  if (isSettled(current)) return Promise.resolve(current);
  if (current === 'unknown') void useConsentStore.getState().check();

  return new Promise((resolve) => {
    const unsubscribe = useConsentStore.subscribe((state) => {
      if (isSettled(state.status)) {
        unsubscribe();
        resolve(state.status);
      }
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
