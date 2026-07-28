import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Avatar, Badge, MapPlaceholder } from '@trisakay/ui';
import { useBookingStore } from '../../src/store/useBookingStore';
import { randomBetween, wait } from '../../src/mocks/delay';
import { styles } from './trip-in-progress.styles';

export default function TripInProgressScreen() {
  const router = useRouter();
  const driver = useBookingStore((state) => state.driver);
  const setTripStatus = useBookingStore((state) => state.setTripStatus);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await wait(randomBetween(5000, 8000));
      if (cancelled) return;
      setTripStatus('awaiting_payment');
      router.replace('/booking/payment');
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <MapPlaceholder variant="route" caption="Map · live route" height="100%" />

      <View style={styles.statusBadgeWrap}>
        <Badge label="On trip" tone="blue" dot />
      </View>

      {driver && (
        <View style={styles.driverStrip}>
          <Avatar name={driver.name} size="md" />
          <View style={styles.textSlot}>
            <Text style={styles.name} numberOfLines={1}>
              {driver.name}
            </Text>
            <Text style={styles.plate}>{driver.plateNumber}</Text>
          </View>
        </View>
      )}
    </View>
  );
}
