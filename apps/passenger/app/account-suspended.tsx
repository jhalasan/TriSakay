import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMotif, Button, IconTile, colors } from '@trisakay/ui';
import { useTranslation } from '../src/hooks/useTranslation';
import { useAuthStore } from '../src/store/useAuthStore';
import { styles } from '../src/styles/account-suspended.styles';

// P1-25 (2026-09-15 launch audit): passenger counterpart to
// apps/driver/app/account-suspended.tsx — previously the passenger app had
// no equivalent gate at all, so a PSO-suspended passenger stayed in the app
// hitting raw RLS rejections instead of a clear, actionable screen.
export default function AccountSuspendedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <BrandMotif size={240} color={colors.danger} opacity={0.05} style={styles.motif} pointerEvents="none" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.haloOuter}>
          <View style={styles.haloInner}>
            <Ionicons name="lock-closed" size={32} color={colors.danger} />
          </View>
        </View>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>

        <View style={styles.officeCard}>
          <Text style={styles.officeLabel}>{t.accountSuspended.psoOfficeLabel}</Text>
          <View style={styles.officeRow}>
            <IconTile icon="location" tone="navy" size={36} />
            <Text style={styles.officeText}>{t.accountSuspended.psoOfficeAddress}</Text>
          </View>
          <View style={styles.officeRow}>
            <IconTile icon="time" tone="navy" size={36} />
            <Text style={styles.officeText}>{t.accountSuspended.psoOfficeHours}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: Math.max(14, insets.bottom + 6) }]}>
        <Text style={styles.caption}>{t.accountSuspended.refreshCaption}</Text>
        <View style={styles.actions}>
          <Button
            label={t.accountSuspended.refreshStatus}
            icon={<Ionicons name="refresh" size={18} color={colors.white} />}
            loading={refreshing}
            onPress={handleRefresh}
            fullWidth
          />
          <Button label={t.accountSuspended.logOut} variant="ghost" tone="neutral" onPress={() => router.push('/logout')} fullWidth />
        </View>
      </View>
    </View>
  );
}
