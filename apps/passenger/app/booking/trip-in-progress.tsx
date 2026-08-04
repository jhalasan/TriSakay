import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, MapOverlaySheet, OsmMap } from '@trisakay/ui';
import { useBookingStore } from '../../src/store/useBookingStore';
import { randomBetween, wait } from '../../src/mocks/delay';
import { styles } from '../../src/styles/booking/trip-in-progress.styles';

export default function TripInProgressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
        edgeToEdge
        // The driver sheet floats across the full width at the bottom, so keep
        // the OSM attribution clear of it.
        attributionLeft
        // Approximate resting height of the driver sheet (handle + padding +
        // avatar row) — only needs to clear the attribution/recenter button,
        // not track the sheet's exact height pixel-for-pixel.
        bottomInset={100}
      />

      <View style={styles.statusBadgeWrap}>
        <Badge label="On trip" tone="blue" dot />
      </View>

      {driver && (
        <MapOverlaySheet bottomInset={insets.bottom}>
          <View style={styles.driverRow}>
            <Avatar name={driver.name} size="md" />
            <View style={styles.textSlot}>
              <Text style={styles.name} numberOfLines={1}>
                {driver.name || 'Driver assigned'}
              </Text>
              <Text style={styles.plate}>{driver.plateNumber || '—'}</Text>
            </View>
          </View>
        </MapOverlaySheet>
      )}
    </View>
  );
}
