import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { colors } from '@trisakay/ui';
import { useAuthStore } from '../src/store/useAuthStore';
import { wait } from '../src/mocks/delay';
import { styles } from './splash.styles';

export default function SplashScreen() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await wait(1400);
      if (cancelled) return;
      router.replace(isAuthenticated ? '/(tabs)/home' : '/(auth)/login');
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
