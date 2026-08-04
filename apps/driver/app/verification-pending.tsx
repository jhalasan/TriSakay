import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors } from '@trisakay/ui';
import { useVerificationStore } from '../src/store/useVerificationStore';
import { styles } from '../src/styles/verification-pending.styles';

const COPY = {
  pending: {
    title: 'Your account is under review',
    body:
      "We've received your registration and documents. Visit the PSO office with your original license, OR/CR, and franchise so a staff member can verify them in person. You'll get a text message or email once your account is approved and you can start accepting rides.",
  },
  rejected: {
    title: "Your verification wasn't approved",
    body: 'Visit the PSO office for next steps on your driver verification.',
  },
} as const;

export default function VerificationPendingScreen() {
  const router = useRouter();
  const status = useVerificationStore((state) => state.status);
  const error = useVerificationStore((state) => state.error);
  const check = useVerificationStore((state) => state.check);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await check();
    setRefreshing(false);
  }

  const copy = COPY[status === 'rejected' ? 'rejected' : 'pending'];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.iconBadge}>
          <Ionicons name="time-outline" size={30} color={colors.accentBluePressed} />
        </View>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <Button
            label="Refresh status"
            variant="outline"
            tone="neutral"
            loading={refreshing || status === 'checking'}
            onPress={handleRefresh}
            fullWidth
          />
          <Button label="Log out" variant="ghost" tone="neutral" onPress={() => router.push('/logout')} fullWidth />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
