import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Linking, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMotif, Button, Spinner, colors } from '@trisakay/ui';
import { triggerEmergencyAlert } from '@trisakay/services/src/emergency/index.ts';
import { interpolate } from '../../src/utils/interpolate';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useTripStore } from '../../src/store/useTripStore';
import { styles } from '../../src/styles/trip/emergency.styles';

type AlertState = 'sending' | 'sent' | 'failed';

/**
 * FR-12 — reached only via active.tsx's hold-to-confirm SOS button. Two
 * distinct actions, deliberately not blended (wireframe review item 9):
 * "Call 911/PNP" is the actual safety mechanism and stays reachable
 * regardless of the incident-log write below it (NFR-4); the PSO
 * notification is fire-and-forget, firing automatically on mount rather
 * than needing its own tap, matching FR-12.3's "in parallel" wording.
 */
export default function DriverEmergencyScreen() {
  const router = useRouter();
  const t = useTranslation();
  const trip = useTripStore((state) => state.current);
  const [alertState, setAlertState] = useState<AlertState>('sending');
  const [sentAt, setSentAt] = useState<string | null>(null);
  const hasFiredRef = useRef(false);

  async function sendAlert() {
    setAlertState('sending');
    try {
      // FR-2.5c mid-trip pickup means a trip can carry more than one
      // passenger — emergency_alerts has room for exactly one counterpart,
      // so it's only ever attributed to a specific ride/passenger when
      // there's no ambiguity about which one that is. With zero or several
      // passengers aboard, both are left null; the location fix below still
      // captures where the driver actually is regardless.
      const soleLeg = trip?.passengers.length === 1 ? trip.passengers[0] : null;
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { error } = await triggerEmergencyAlert({
        rideRequestId: soleLeg?.id ?? null,
        triggeredRole: 'driver',
        counterpartId: soleLeg?.passengerId ?? null,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
      if (error) {
        setAlertState('failed');
      } else {
        setSentAt(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
        setAlertState('sent');
      }
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

  if (!trip) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <BrandMotif size={250} color={colors.danger} opacity={0.09} style={styles.motif} />
      <View style={styles.content}>
        <View style={styles.iconBadge}>
          <Ionicons name="warning" size={32} color={colors.white} />
        </View>
        <Text style={styles.title}>{t.emergency.title}</Text>
        <Text style={styles.subtitle}>{t.emergency.subtitle}</Text>

        <View style={styles.dialSection}>
          <Button
            label={t.emergency.callButton}
            tone="danger"
            icon={<Ionicons name="call" size={20} color={colors.white} />}
            fullWidth
            onPress={() => Linking.openURL('tel:911')}
          />
        </View>

        <View style={styles.psoCard}>
          {alertState === 'sending' && (
            <>
              <Spinner size="small" />
              <Text style={styles.psoStatusText}>{t.emergency.notifyingPso}</Text>
            </>
          )}
          {alertState === 'sent' && (
            <>
              <Ionicons name="checkmark-circle" size={19} color={colors.accentGreen} style={styles.psoIcon} />
              <View style={styles.psoTextBlock}>
                <Text style={styles.psoStatusText}>{t.emergency.notifiedPso}</Text>
                {sentAt && <Text style={styles.psoStatusTime}>{interpolate(t.emergency.sentAtLabel, { time: sentAt })}</Text>}
              </View>
            </>
          )}
          {alertState === 'failed' && (
            <View style={styles.psoTextBlock}>
              <Text style={styles.psoStatusTextError}>{t.emergency.notifyFailed}</Text>
              <Pressable onPress={sendAlert} hitSlop={8}>
                <Text style={styles.retryLink}>{t.emergency.retry}</Text>
              </Pressable>
            </View>
          )}
        </View>

        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backLink}>{t.emergency.backToTrip}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
