import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors } from '@trisakay/ui';
import { getDeactivationOrigin } from '@trisakay/services';
import { useTranslation } from '../src/hooks/useTranslation';
import { useAuthStore } from '../src/store/useAuthStore';
import { styles } from '../src/styles/account-suspended.styles';

export default function AccountSuspendedScreen() {
  const router = useRouter();
  const t = useTranslation();
  const accountStatus = useAuthStore((state) => state.user?.accountStatus);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const [refreshing, setRefreshing] = useState(false);
  const [origin, setOrigin] = useState<'self' | 'staff' | null>(null);
  const reactivateAccount = useAuthStore((state) => state.reactivateAccount);
  const [reactivating, setReactivating] = useState(false);
  const [reactivateError, setReactivateError] = useState<string | null>(null);

  // An account the person deactivated themself can be reactivated here; one deactivated by the PSO cannot.
  useEffect(() => {
    if (accountStatus !== 'deactivated') {
      setOrigin(null);
      return;
    }
    getDeactivationOrigin()
      .then(setOrigin)
      .catch(() => setOrigin(null));
  }, [accountStatus]);
  const canReactivate = accountStatus === 'deactivated' && origin === 'self';

  async function handleReactivate() {
    setReactivating(true);
    setReactivateError(null);
    const failure = await reactivateAccount();
    setReactivating(false);
    if (failure) setReactivateError(`${t.accountMgmt.reactivateFailed} ${failure}`);
  }


  async function handleRefresh() {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  }

  const copy = canReactivate
    ? { title: t.accountMgmt.reactivateTitle, body: t.accountMgmt.reactivateBody }
    : accountStatus === 'deactivated'
      ? { title: t.driver.accountSuspended.deactivatedTitle, body: t.driver.accountSuspended.deactivatedBody }
      : { title: t.driver.accountSuspended.suspendedTitle, body: t.driver.accountSuspended.suspendedBody };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.iconBadge}>
          <Ionicons name="alert-circle-outline" size={30} color={colors.danger} />
        </View>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>

        {!canReactivate && (
        <View style={styles.officeCard}>
          <Text style={styles.officeLabel}>{t.driver.accountSuspended.psoOfficeLabel}</Text>
          <Text style={styles.officeAddress}>{t.driver.accountSuspended.psoOfficeAddress}</Text>
          <Text style={styles.officeHours}>{t.driver.accountSuspended.psoOfficeHours}</Text>
        </View>
        )}

        <View style={styles.actions}>
          {canReactivate && (
            <Button label={t.accountMgmt.reactivate} loading={reactivating} onPress={handleReactivate} fullWidth />
          )}
          {reactivateError && <Text style={styles.body}>{reactivateError}</Text>}
          <Button
            label={t.driver.accountSuspended.refreshStatus}
            variant="outline"
            tone="neutral"
            icon={<Ionicons name="refresh" size={18} color={colors.ink} />}
            loading={refreshing}
            onPress={handleRefresh}
            fullWidth
          />
          <Button label={t.driver.accountSuspended.logOut} variant="ghost" tone="neutral" onPress={() => router.push('/logout')} fullWidth />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
