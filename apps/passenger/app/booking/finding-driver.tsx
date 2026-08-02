import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Button, OsmMap, colors } from '@trisakay/ui';
import { PulseBeacon } from '../../src/components/PulseBeacon';
import { useBookingStore } from '../../src/store/useBookingStore';
import { styles } from '../../src/styles/booking/finding-driver.styles';

export default function FindingDriverScreen() {
  const router = useRouter();
  const pickup = useBookingStore((state) => state.pickup);
  const dropoff = useBookingStore((state) => state.dropoff);
  const rideRequestId = useBookingStore((state) => state.rideRequestId);
  const setTripStatus = useBookingStore((state) => state.setTripStatus);
  const reset = useBookingStore((state) => state.reset);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    if (!rideRequestId) {
      router.replace('/(tabs)/home');
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    import('@trisakay/services').then(({ subscribeToRideRequestStatus }) => {
      if (cancelled) return;
      unsubscribe = subscribeToRideRequestStatus(rideRequestId, (row) => {
        if (row.status === 'assigned') {
          setTripStatus('matched');
          router.replace('/booking/driver-found');
        } else if (row.status === 'cancelled') {
          reset();
          router.replace('/(tabs)/home');
        }
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideRequestId]);

  async function handleCancel() {
    if (!rideRequestId) return;

    setIsCancelling(true);
    setCancelError(null);

    const { cancelRideRequest } = await import('@trisakay/services');
    const { error } = await cancelRideRequest(rideRequestId, 'Cancelled by passenger');

    setIsCancelling(false);

    if (error) {
      setCancelError(error);
      return;
    }

    reset();
    router.replace('/(tabs)/home');
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapFill}>
        <OsmMap
          variant="plain"
          height="100%"
          latitude={pickup?.latitude}
          longitude={pickup?.longitude}
          zoom={16}
          // Full-screen with only a sheet below it — no scroller to compete with.
          interactive
        />
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
          <Button
            label="Cancel request"
            variant="outline"
            tone="neutral"
            fullWidth
            loading={isCancelling}
            disabled={isCancelling}
            onPress={handleCancel}
          />
        </View>
        {cancelError && <Text style={styles.cancelError}>{cancelError}</Text>}
      </View>
    </View>
  );
}
