import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { colors } from '@trisakay/ui';
import { useAuthStore } from '../src/store/useAuthStore';
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

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await Promise.all([wait(1400), waitUntilHydrated()]);
      if (cancelled) return;
      const isAuthenticated = useAuthStore.getState().isAuthenticated;
      router.replace(isAuthenticated ? '/(tabs)/home' : '/(auth)/login');
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <View style={styles.mark}>
        <Text style={styles.markText}>TS</Text>
      </View>
      <Text style={styles.title}>TriSakay</Text>
      <Text style={styles.subtitle}>Book a tricycle, hassle-free</Text>
      <ActivityIndicator color={colors.white} style={styles.loader} />
    </View>
  );
}
