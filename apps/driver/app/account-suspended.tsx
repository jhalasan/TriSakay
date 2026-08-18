import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors } from '@trisakay/ui';
import { useAuthStore } from '../src/store/useAuthStore';
import { styles } from '../src/styles/account-suspended.styles';

const COPY = {
  suspended: {
    title: 'Your account has been suspended',
    body: 'A PSO staff member has suspended your account. Visit the PSO office for details and next steps before you can accept rides again.',
  },
  deactivated: {
    title: 'Your account has been deactivated',
    body: 'A PSO staff member has deactivated your account. Visit the PSO office for details and next steps.',
  },
} as const;

export default function AccountSuspendedScreen() {
  const router = useRouter();
  const accountStatus = useAuthStore((state) => state.user?.accountStatus);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  }

  const copy = COPY[accountStatus === 'deactivated' ? 'deactivated' : 'suspended'];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.iconBadge}>
          <Ionicons name="alert-circle-outline" size={30} color={colors.danger} />
        </View>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>

        <View style={styles.actions}>
          <Button label="Refresh status" variant="outline" tone="neutral" loading={refreshing} onPress={handleRefresh} fullWidth />
          <Button label="Log out" variant="ghost" tone="neutral" onPress={() => router.push('/logout')} fullWidth />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
