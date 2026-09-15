import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors } from '@trisakay/ui';
import { useTranslation } from '../src/hooks/useTranslation';
import { useAuthStore } from '../src/store/useAuthStore';
import { styles } from '../src/styles/account-suspended.styles';

// P1-25 (2026-09-15 launch audit): passenger counterpart to
// apps/driver/app/account-suspended.tsx — previously the passenger app had
// no equivalent gate at all, so a PSO-suspended passenger stayed in the app
// hitting raw RLS rejections instead of a clear, actionable screen.
export default function AccountSuspendedScreen() {
  const router = useRouter();
  const t = useTranslation();
  const accountStatus = useAuthStore((state) => state.user?.accountStatus);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  }

  const copy =
    accountStatus === 'deactivated'
      ? { title: t.accountSuspended.deactivatedTitle, body: t.accountSuspended.deactivatedBody }
      : { title: t.accountSuspended.suspendedTitle, body: t.accountSuspended.suspendedBody };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.iconBadge}>
          <Ionicons name="alert-circle-outline" size={30} color={colors.danger} />
        </View>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>

        <View style={styles.officeCard}>
          <Text style={styles.officeLabel}>{t.accountSuspended.psoOfficeLabel}</Text>
          <Text style={styles.officeAddress}>{t.accountSuspended.psoOfficeAddress}</Text>
          <Text style={styles.officeHours}>{t.accountSuspended.psoOfficeHours}</Text>
        </View>

        <View style={styles.actions}>
          <Button
            label={t.accountSuspended.refreshStatus}
            variant="outline"
            tone="neutral"
            icon={<Ionicons name="refresh" size={18} color={colors.ink} />}
            loading={refreshing}
            onPress={handleRefresh}
            fullWidth
          />
          <Button label={t.accountSuspended.logOut} variant="ghost" tone="neutral" onPress={() => router.push('/logout')} fullWidth />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
