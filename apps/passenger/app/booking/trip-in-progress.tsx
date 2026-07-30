import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Avatar, Badge, OsmMap } from '@trisakay/ui';
import { useBookingStore } from '../../src/store/useBookingStore';
import { randomBetween, wait } from '../../src/mocks/delay';
import { styles } from '../../src/styles/booking/trip-in-progress.styles';

export default function TripInProgressScreen() {
  const router = useRouter();
  const driver = useBookingStore((state) => state.driver);
  const pickup = useBookingStore((state) => state.pickup);
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
      <OsmMap
        variant="route"
        caption="Map · live route"
        height="100%"
        latitude={pickup?.latitude}
        longitude={pickup?.longitude}
        zoom={16}
        interactive
        // driverStrip sits at bottom: 24 across nearly the full width, so keep
        // the OSM attribution clear of it.
        attributionLeft
        // Height of that strip plus an 8px gap: spacing.xl (24) bottom offset +
        // spacing.md padding twice (24) + the text slot, which is taller than the
        // 40pt avatar at bodyStrong 24 + gap 2 + caption 18 = 44.
        bottomInset={100}
      />

      <View style={styles.statusBadgeWrap}>
        <Badge label="On trip" tone="blue" dot />
      </View>

      {driver && (
        <View style={styles.driverStrip}>
          <Avatar name={driver.name} size="md" />
          <View style={styles.textSlot}>
            <Text style={styles.name} numberOfLines={1}>
              {driver.name || 'Driver assigned'}
            </Text>
            <Text style={styles.plate}>{driver.plateNumber || '—'}</Text>
          </View>
        </View>
      )}
    </View>
  );
}
