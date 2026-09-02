import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMotif, Button, GradientSurface, PulseRing, Spinner, colors, motion } from '@trisakay/ui';
import { triggerEmergencyAlert } from '@trisakay/services/src/emergency/index.ts';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useBookingStore } from '../../src/store/useBookingStore';
import { styles } from '../../src/styles/booking/emergency.styles';

type AlertState = 'sending' | 'sent' | 'failed';

/**
 * FR-12 — reached only via trip.tsx's hold-to-confirm SOS button. Mirrors
 * apps/driver/app/trip/emergency.tsx exactly: "Call 911/PNP" stays
 * reachable regardless of the incident-log write below it (NFR-4); the PSO
 * notification fires automatically on mount, matching FR-12.3's "in
 * parallel" wording rather than needing its own tap.
 */
export default function PassengerEmergencyScreen() {
  const router = useRouter();
  const t = useTranslation();
  const driver = useBookingStore((state) => state.driver);
  const dropoff = useBookingStore((state) => state.dropoff);
  const rideRequestId = useBookingStore((state) => state.rideRequestId);
  const [alertState, setAlertState] = useState<AlertState>('sending');
  const hasFiredRef = useRef(false);

  async function sendAlert() {
    setAlertState('sending');
    try {
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { error } = await triggerEmergencyAlert({
        rideRequestId: rideRequestId ?? null,
        triggeredRole: 'passenger',
        counterpartId: driver?.id ?? null,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
      setAlertState(error ? 'failed' : 'sent');
    } catch {
      setAlertState('failed');
    }
  }

  useEffect(() => {
    if (hasFiredRef.current) return;
    hasFiredRef.current = true;
    sendAlert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!driver) {
    return <Redirect href="/(tabs)/home" />;
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScrollView bounces={false}>
        <GradientSurface token="sos" direction="diagonal" style={styles.band}>
          <BrandMotif size={210} color="#FFFFFF" opacity={0.14} style={styles.motif} />
          <View style={styles.pulseWrap}>
            <PulseRing size={72} color="rgba(255,255,255,0.28)" durationMs={motion.duration.pulseStatus} style={styles.pulseRing} />
            <View style={styles.alertCore}>
              <Ionicons name="warning" size={32} color={colors.white} />
            </View>
          </View>
          <Text style={styles.title}>{t.emergency.title}</Text>
          <Text style={styles.subtitle}>{t.emergency.subtitle}</Text>
        </GradientSurface>

        <View style={styles.content}>
          <Button label={t.emergency.callButton} tone="danger" fullWidth onPress={() => Linking.openURL('tel:911')} />

          {alertState === 'sending' && (
            <View style={[styles.statusRow, styles.statusRowSending]}>
              <Spinner size="small" />
              <Text style={styles.statusText}>{t.emergency.notifyingPso}</Text>
            </View>
          )}
          {alertState === 'sent' && (
            <View style={[styles.statusRow, styles.statusRowSent]}>
              <View style={styles.statusIconTile}>
                <Ionicons name="checkmark" size={17} color={colors.white} />
              </View>
              <Text style={styles.statusText}>{t.emergency.notifiedPso}</Text>
            </View>
          )}
          {alertState === 'failed' && (
            <View style={[styles.statusRow, styles.statusRowFailed]}>
              <Text style={styles.statusTextFailed}>{t.emergency.notifyFailed}</Text>
              <Pressable onPress={sendAlert} hitSlop={8}>
                <Text style={styles.retryLink}>{t.emergency.retry}</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.sharedPanel}>
            <Text style={styles.sharedLabel}>{t.emergency.sharedWithPso}</Text>
            <View style={styles.sharedRow}>
              <Ionicons name="person" size={15} color={colors.inkSoft} />
              <Text style={styles.sharedRowText} numberOfLines={1}>
                {driver.name}
                {driver.plateNumber ? ` · ${driver.plateNumber}` : ''}
              </Text>
            </View>
            {dropoff && (
              <View style={styles.sharedRow}>
                <Ionicons name="navigate" size={15} color={colors.inkSoft} />
                <Text style={styles.sharedRowText} numberOfLines={1}>
                  {t.payment.tripTo} {dropoff.label}
                </Text>
              </View>
            )}
          </View>

          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.backLink}>{t.emergency.backToTrip}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
