import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { BrandMotif, GradientSurface } from '@trisakay/ui';
import { useAuthStore } from '../src/store/useAuthStore';
import { useConsentStore, type ConsentGateStatus } from '../src/store/useConsentStore';
import { wait } from '../src/mocks/delay';
import { styles } from '../src/styles/splash.styles';

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
    <GradientSurface token="hero" direction="vertical" style={styles.gradient}>
      <View style={styles.container}>
        <BrandMotif size={360} color="#FFFFFF" opacity={0.08} style={styles.motif} />
        <View style={styles.badge}>
          <Image
            source={require('../../../assets/brand/trisakay-lockup.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="TriSakay"
          />
        </View>
        <Text style={styles.subtitle}>Drive with TriSakay</Text>
        <ActivityIndicator color="#FFFFFF" style={styles.loader} />
      </View>
    </GradientSurface>
  );
}
