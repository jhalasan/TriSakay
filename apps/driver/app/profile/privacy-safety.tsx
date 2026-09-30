import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { CollapsibleRow, IconTile, SosCard, colors, type SosCardState } from '@trisakay/ui';
import { triggerEmergencyAlert } from '@trisakay/services';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useLocationPermission } from '../../src/hooks/useLocationPermission';
import { useTranslation } from '../../src/hooks/useTranslation';
import { interpolate } from '../../src/utils/interpolate';
import { REQUEST_TIMEOUT_MS, withTimeout } from '../../src/utils/withTimeout';
import { styles } from '../../src/styles/profile/privacy-safety.styles';

type LearnRow = 'sos' | 'tips' | 'data';

/**
 * Mirrors apps/passenger/app/profile/privacy-safety.tsx: one press-and-hold
 * SOS (the old confirm Alert only remains as the screen-reader fallback), a
 * separate quiet 911 row, account security and the reading material
 * collapsed. `emergency_alerts.ride_request_id` has always been nullable and
 * `emergency_insert_own`'s RLS never required a ride, so the anytime SOS
 * needs no backend change.
 */
export default function PrivacySafetyScreen() {
  const router = useRouter();
  const t = useTranslation();
  const p = t.privacySafety;
  const { isGranted, request } = useLocationPermission();

  const [sosState, setSosState] = useState<SosCardState>('idle');
  const [sentAt, setSentAt] = useState<Date | null>(null);
  const [openRows, setOpenRows] = useState<Set<LearnRow>>(new Set());

  const tips = [t.driver.safety.tip1, t.driver.safety.tip2, t.driver.safety.tip3];

  function toggleRow(row: LearnRow) {
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(row)) next.delete(row);
      else next.add(row);
      return next;
    });
  }

  async function sendSos() {
    setSosState('sending');
    try {
      let granted = isGranted;
      if (!granted) {
        granted = (await request()) === 'granted';
      }
      if (!granted) {
        setSosState('failed');
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
      } else {
        setSentAt(new Date());
        setSosState('sent');
      }
    } catch {
      setSosState('failed');
    }
  }

  const sentTime = (sentAt ?? new Date()).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });

  return (
    <View style={styles.container}>
      <ScreenHeader title={p.eyebrow} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SosCard
          state={sosState}
          onSend={() => void sendSos()}
          onCall911={() => Linking.openURL('tel:911')}
          copy={{
            holdLabel: p.holdLabel,
            holdSub: p.holdSub,
            title: p.sosButton,
            sendingTitle: p.sendingTitle,
            body: p.holdBody,
            call911Title: t.safety.callButton,
            call911Sub: p.call911Sub,
            sentTitle: p.sentTitle,
            sentBody: interpolate(p.sentBody, { time: sentTime }),
            failedMessage: p.sosFailed,
            retry: p.retry,
            a11yLabel: p.sosButton,
            a11yHint: p.sosA11yHint,
            confirmTitle: p.sosConfirmTitle,
            confirmMessage: p.sosConfirmMessage,
            confirmButton: p.sosConfirmButton,
            cancel: t.common.cancel,
          }}
        />

        <View>
          <Text style={styles.sectionLabel}>{p.sectionAccountSecurity}</Text>
          <View style={styles.card}>
            <Pressable accessibilityRole="button" onPress={() => router.push('/profile/change-password')} style={styles.navRow}>
              <IconTile icon="key" tone="navy" size={38} />
              <View style={styles.navBody}>
                <Text style={styles.navTitle}>{p.changePasswordRow}</Text>
                <Text style={styles.navSub}>{p.changePasswordRowSubtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.inkSoft} />
            </Pressable>
          </View>
        </View>

        <View>
          <Text style={styles.sectionLabel}>{p.learnMore}</Text>
          <View style={styles.learnCard}>
            <CollapsibleRow
              title={t.safety.howSosWorksTitle}
              leading={<IconTile icon="hand-left" tone="navy" size={34} />}
              open={openRows.has('sos')}
              onToggle={() => toggleRow('sos')}
              bodyIndent={44}
            >
              <Text style={styles.learnBody}>{t.driver.safety.howSosWorksBody}</Text>
            </CollapsibleRow>
            <View style={styles.learnDivider}>
              <CollapsibleRow
                title={t.safety.tipsTitle}
                leading={<IconTile icon="shield-checkmark" tone="green" size={34} />}
                trailing={
                  <View style={styles.countPill}>
                    <Text style={styles.countText}>{tips.length}</Text>
                  </View>
                }
                open={openRows.has('tips')}
                onToggle={() => toggleRow('tips')}
                bodyIndent={44}
              >
                <View style={styles.tipList}>
                  {tips.map((tip) => (
                    <View key={tip} style={styles.tipRow}>
                      <View style={styles.tipBullet} />
                      <Text style={styles.tipText}>{tip}</Text>
                    </View>
                  ))}
                </View>
              </CollapsibleRow>
            </View>
            <View style={styles.learnDivider}>
              <CollapsibleRow
                title={p.yourDataTitle}
                leading={<IconTile icon="eye" tone="neutral" size={34} />}
                open={openRows.has('data')}
                onToggle={() => toggleRow('data')}
                bodyIndent={44}
              >
                <Text style={styles.learnBody}>{p.yourDataBody}</Text>
              </CollapsibleRow>
            </View>
          </View>
        </View>

        <Pressable accessibilityRole="button" onPress={() => router.push('/complaints')} style={styles.footerLink}>
          <Ionicons name="flag-outline" size={14} color={colors.accentBlue} />
          <Text style={styles.footerLinkText}>{t.safety.reportIssueLink}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
