import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Button, MapPlaceholder, colors } from '@trisakay/ui';
import { PulseBeacon } from '../../src/components/PulseBeacon';
import { useBookingStore } from '../../src/store/useBookingStore';
import { pickRandomDriver } from '../../src/mocks/drivers';
import { randomBetween, wait } from '../../src/mocks/delay';
import { styles } from './finding-driver.styles';

export default function FindingDriverScreen() {
  const router = useRouter();
  const dropoff = useBookingStore((state) => state.dropoff);
  const setDriver = useBookingStore((state) => state.setDriver);
  const setTripStatus = useBookingStore((state) => state.setTripStatus);
  const reset = useBookingStore((state) => state.reset);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await wait(randomBetween(2500, 4000));
      if (cancelled) return;
      setDriver(pickRandomDriver());
      setTripStatus('matched');
      router.replace('/booking/driver-found');
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCancel() {
    reset();
    router.replace('/(tabs)/home');
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapFill}>
        <MapPlaceholder variant="plain" height="100%" />
        <View style={styles.beaconWrap} pointerEvents="none">
          <PulseBeacon size={80}>
            <Ionicons name="search" size={32} color={colors.white} />
          </PulseBeacon>
        </View>
      </View>

      <View style={styles.sheet}>
        <Text style={styles.title}>Finding a driver</Text>
        <Text style={styles.subtitle}>
          {dropoff ? `Looking for a tricycle to ${dropoff.label}` : 'Looking for a tricycle nearby'}
        </Text>
        <View style={styles.cancelButton}>
          <Button label="Cancel request" variant="outline" tone="neutral" fullWidth onPress={handleCancel} />
        </View>
      </View>
    </View>
  );
}
