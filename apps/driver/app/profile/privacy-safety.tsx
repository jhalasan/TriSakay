import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { BrandMotif, Button, GradientSurface, Spinner, colors } from '@trisakay/ui';
import { triggerEmergencyAlert } from '@trisakay/services';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useLocationPermission } from '../../src/hooks/useLocationPermission';
import { useTranslation } from '../../src/hooks/useTranslation';
import { REQUEST_TIMEOUT_MS, withTimeout } from '../../src/utils/withTimeout';
import { styles } from '../../src/styles/profile/privacy-safety.styles';

type SosState = 'idle' | 'sending' | 'sent' | 'failed';

/**
 * Mirrors apps/passenger/app/profile/privacy-safety.tsx (2026-09-16), same
 * structure and same reasoning: the safety half of what used to be a single
 * combined screen — an SOS you can send to PSO any time, not only while
 * `trip/emergency.tsx`'s in-trip hold-button is reachable, plus account
 * security. Location tracking (real here, wired to useDriverLocationSync —
 * unlike the passenger app's inert prototype toggle) and the Legal Policy
 * link stay in Settings, same as the passenger app's split.
 * `emergency_alerts.ride_request_id` has always been nullable and
 * `emergency_insert_own`'s RLS never required a ride, so the anytime SOS
 * needed no backend change beyond the notify_pso_on_emergency() wording fix
 * (2026-09-16 migration) that stopped assuming a ride is always attached.
 */
export default function PrivacySafetyScreen() {
  const router = useRouter();
  const t = useTranslation();
  const { isGranted, request } = useLocationPermission();

  const [sosState, setSosState] = useState<SosState>('idle');
  const [sosError, setSosError] = useState<string | null>(null);

  const tips = [t.driver.safety.tip1, t.driver.safety.tip2, t.driver.safety.tip3];

  async function sendSos() {
    setSosState('sending');
    setSosError(null);
    try {
      let granted = isGranted;
      if (!granted) {
        granted = (await request()) === 'granted';
      }
      if (!granted) {
        setSosState('failed');
        setSosError(t.privacySafety.sosLocationRequired);
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { error } = await withTimeout(
        triggerEmergencyAlert({
          rideRequestId: null,
          triggeredRole: 'driver',
          counterpartId: null,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
        REQUEST_TIMEOUT_MS,
        'Emergency alert timed out'
      );

      if (error) {
        setSosState('failed');
        setSosError(error);
      } else {
        setSosState('sent');
      }
    } catch {
      setSosState('failed');
      setSosError(t.privacySafety.sosFailed);
    }
  }

  function confirmSos() {
    Alert.alert(t.privacySafety.sosConfirmTitle, t.privacySafety.sosConfirmMessage, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.privacySafety.sosConfirmButton, style: 'destructive', onPress: () => void sendSos() },
    ]);
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={t.privacySafety.title} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroShadowWrap}>
          <GradientSurface token="sos" direction="diagonal" style={styles.hero}>
            <BrandMotif size={150} color={colors.white} opacity={0.14} style={styles.heroMotif} />
            <View style={styles.heroIconTile}>
              <Ionicons name="shield-checkmark" size={22} color={colors.white} />
            </View>
            <Text style={styles.heroEyebrow}>{t.privacySafety.eyebrow}</Text>
            <Text style={styles.heroTitle}>{t.privacySafety.title}</Text>
            <Text style={styles.heroSubtitle}>{t.privacySafety.subtitle}</Text>
          </GradientSurface>
        </View>

        <View style={styles.sosGroup}>
          <Button
            label={t.privacySafety.sosButton}
            tone="danger"
            fullWidth
            loading={sosState === 'sending'}
            onPress={confirmSos}
          />
          <Button label={t.safety.callButton} variant="outline" tone="danger" fullWidth onPress={() => Linking.openURL('tel:911')} />

          {sosState === 'sending' && (
            <View style={[styles.statusRow, styles.statusRowSending]}>
              <Spinner size="small" />
              <Text style={styles.statusText}>{t.privacySafety.sosSending}</Text>
            </View>
          )}
          {sosState === 'sent' && (
            <View style={[styles.statusRow, styles.statusRowSent]}>
              <Ionicons name="checkmark-circle" size={16} color={colors.accentGreenPressed} />
              <Text style={styles.statusText}>{t.privacySafety.sosSent}</Text>
            </View>
          )}
          {sosState === 'failed' && (
            <View style={[styles.statusRow, styles.statusRowFailed]}>
              <Text style={styles.statusTextFailed}>{sosError ?? t.privacySafety.sosFailed}</Text>
              <Pressable onPress={confirmSos} hitSlop={8}>
                <Text style={styles.retryLink}>{t.privacySafety.retry}</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Moved up, right under the primary SOS action and ahead of the
            longer "How SOS works"/tips reading material: account security
            is a setting a user comes here to tap, not to read, so it
            shouldn't need a scroll past informational copy to reach. */}
        <View>
          <Text style={styles.sectionLabel}>{t.privacySafety.sectionAccountSecurity}</Text>
          <View style={styles.navCard}>
            <Pressable style={styles.row} onPress={() => router.push('/profile/change-password')} accessibilityRole="button">
              <View style={styles.rowLeading}>
                <View style={styles.iconBadge}>
                  <Ionicons name="key-outline" size={16} color={colors.accentBluePressed} />
                </View>
                <View style={styles.rowTextSlot}>
                  <Text style={styles.rowLabel}>{t.privacySafety.changePasswordRow}</Text>
                  <Text style={styles.rowSublabel} numberOfLines={1}>
                    {t.privacySafety.changePasswordRowSubtitle}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <View style={styles.cardIconTile}>
              <Ionicons name="hand-left-outline" size={16} color={colors.accentBluePressed} />
            </View>
            <Text style={styles.cardTitle}>{t.safety.howSosWorksTitle}</Text>
          </View>
          <Text style={styles.cardBody}>{t.driver.safety.howSosWorksBody}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.safety.tipsTitle}</Text>
          {tips.map((tip) => (
            <View key={tip} style={styles.tipRow}>
              <View style={styles.tipBullet} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
          <Pressable accessibilityRole="button" style={styles.linkRow} onPress={() => router.push('/complaints')}>
            <Text style={styles.link}>{t.safety.reportIssueLink}</Text>
          </Pressable>
        </View>

        <View style={styles.noticeBox}>
          <Ionicons name="information-circle-outline" size={16} color={colors.inkSoft} style={styles.noticeIcon} />
          <View style={styles.noticeTextSlot}>
            <Text style={styles.cardTitle}>{t.privacySafety.yourDataTitle}</Text>
            <Text style={styles.noticeText}>{t.privacySafety.yourDataBody}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
