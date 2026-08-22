import { useEffect, useRef, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Linking, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Spinner } from '@trisakay/ui';
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
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={styles.title}>{t.emergency.title}</Text>
        <Text style={styles.subtitle}>{t.emergency.subtitle}</Text>

        <View style={styles.dialSection}>
          <Button label={t.emergency.callButton} tone="danger" fullWidth onPress={() => Linking.openURL('tel:911')} />
        </View>

        <View style={styles.psoStatus}>
          {alertState === 'sending' && (
            <>
              <Spinner size="small" />
              <Text style={styles.psoStatusText}>{t.emergency.notifyingPso}</Text>
            </>
          )}
          {alertState === 'sent' && <Text style={styles.psoStatusText}>{t.emergency.notifiedPso}</Text>}
          {alertState === 'failed' && (
            <View>
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
