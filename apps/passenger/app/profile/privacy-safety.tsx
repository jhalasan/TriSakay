import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { BrandMotif, Button, Card, GradientSurface, ListRow, Spinner, Toggle, colors } from '@trisakay/ui';
import { triggerEmergencyAlert } from '@trisakay/services';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useLocationPermission } from '../../src/hooks/useLocationPermission';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useSettingsStore } from '../../src/store/useSettingsStore';
import { styles } from '../../src/styles/profile/privacy-safety.styles';

type SosState = 'idle' | 'sending' | 'sent' | 'failed';

/**
 * One home for everything about staying safe and controlling your data —
 * consolidates what used to be two unrelated Settings rows (Terms & Privacy,
 * Safety Center) plus the Privacy section's Location toggle, and adds the
 * one thing none of those covered: an SOS you can send to PSO any time, not
 * only while `booking/emergency.tsx`'s in-trip hold-button is reachable.
 * `emergency_alerts.ride_request_id` has always been nullable and
 * `emergency_insert_own`'s RLS never required a ride, so this needed no
 * backend change beyond correcting the PSO-facing notification wording
 * (see the 2026-09-16 migration) to stop assuming a ride is attached.
 */
export default function PrivacySafetyScreen() {
  const router = useRouter();
  const t = useTranslation();
  const { isGranted, request } = useLocationPermission();
  const locationTrackingEnabled = useSettingsStore((state) => state.locationTrackingEnabled);
  const toggleLocationTracking = useSettingsStore((state) => state.toggleLocationTracking);

  const [sosState, setSosState] = useState<SosState>('idle');
  const [sosError, setSosError] = useState<string | null>(null);

  const tips = [t.safety.tip1, t.safety.tip2, t.safety.tip3];

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
      const { error } = await triggerEmergencyAlert({
        rideRequestId: null,
        triggeredRole: 'passenger',
        counterpartId: null,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });

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

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <View style={styles.cardIconTile}>
              <Ionicons name="hand-left-outline" size={16} color={colors.accentBluePressed} />
            </View>
            <Text style={styles.cardTitle}>{t.safety.howSosWorksTitle}</Text>
          </View>
          <Text style={styles.cardBody}>{t.safety.howSosWorksBody}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.safety.tipsTitle}</Text>
          {tips.map((tip) => (
            <View key={tip} style={styles.tipRow}>
              <View style={styles.tipBullet} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
          <Pressable accessibilityRole="button" style={styles.linkRow} onPress={() => router.push('/(tabs)/complaints')}>
            <Text style={styles.link}>{t.safety.reportIssueLink}</Text>
          </Pressable>
        </View>

        <View>
          <Text style={styles.sectionLabel}>{t.settings.sectionPrivacySafety}</Text>
          <Card variant="raised" style={styles.navGroup}>
            <ListRow
              title={t.settings.locationTracking}
              subtitle={t.settings.locationTrackingSubtitle}
              leading={
                <View style={styles.navIconTile}>
                  <Ionicons name="location-outline" size={18} color={colors.accentBluePressed} />
                </View>
              }
              trailing={<Toggle value={locationTrackingEnabled} onValueChange={toggleLocationTracking} />}
              divider={false}
            />
          </Card>
        </View>

        <View>
          <Text style={styles.sectionLabel}>{t.privacySafety.sectionAccountSecurity}</Text>
          <Card variant="raised" style={styles.navGroup}>
            <ListRow
              title={t.privacySafety.changePasswordRow}
              subtitle={t.privacySafety.changePasswordRowSubtitle}
              leading={
                <View style={styles.navIconTile}>
                  <Ionicons name="key-outline" size={18} color={colors.accentBluePressed} />
                </View>
              }
              onPress={() => router.push('/profile/change-password')}
              chevron
              divider={false}
            />
          </Card>
        </View>

        <View>
          <Text style={styles.sectionLabel}>{t.privacySafety.sectionLegal}</Text>
          <Card variant="raised" style={styles.navGroup}>
            <ListRow
              title={t.privacySafety.termsPrivacyRow}
              subtitle={t.privacySafety.termsPrivacyRowSubtitle}
              leading={
                <View style={styles.navIconTile}>
                  <Ionicons name="document-text-outline" size={18} color={colors.accentBluePressed} />
                </View>
              }
              onPress={() => router.push('/profile/legal')}
              chevron
              divider={false}
            />
          </Card>
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
