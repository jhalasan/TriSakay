import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  cancelRideRequest,
  getTripDriverInfo,
  subscribeToRideRequestStatus,
  type TripDriverInfo,
} from '@trisakay/services';
import { Button, MapOverlaySheet, OsmMap, colors } from '@trisakay/ui';
import { PulseBeacon } from '../../src/components/PulseBeacon';
import { useBookingStore } from '../../src/store/useBookingStore';
import { useTranslation } from '../../src/hooks/useTranslation';
import { styles } from '../../src/styles/booking/finding-driver.styles';

export default function FindingDriverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const pickup = useBookingStore((state) => state.pickup);
  const dropoff = useBookingStore((state) => state.dropoff);
  const rideRequestId = useBookingStore((state) => state.rideRequestId);
  const setTripStatus = useBookingStore((state) => state.setTripStatus);
  const setDriver = useBookingStore((state) => state.setDriver);
  const reset = useBookingStore((state) => state.reset);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  // Guards against a second, redundant exit: reset() clears rideRequestId,
  // which re-fires this effect (deps: [rideRequestId]) before the component
  // finishes unmounting from the first navigate-away.
  const hasExitedRef = useRef(false);

  useEffect(() => {
    if (hasExitedRef.current) return;

    if (!rideRequestId) {
      hasExitedRef.current = true;
      reset();
      router.replace('/(tabs)/home');
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const applyDriverAndAdvance = (data?: TripDriverInfo | null) => {
      if (cancelled) return;
      setDriver({
        id: data?.driverId ?? '',
        name: data?.driverName ?? '',
        plateNumber: data?.plateNo ?? '',
        rating: data?.ratingAvg ?? null,
        etaMinutes: null,
        avatarUrl: data?.avatarUrl ?? null,
      });
      setTripStatus('matched');
      router.replace('/booking/trip');
    };

    unsubscribe = subscribeToRideRequestStatus(
      rideRequestId,
      (row) => {
        if (cancelled || hasExitedRef.current) return;
        if (row.status === 'assigned') {
          hasExitedRef.current = true;
          getTripDriverInfo(row.id)
            .then(({ data }) => applyDriverAndAdvance(data))
            .catch(() => applyDriverAndAdvance());
        } else if (row.status === 'cancelled') {
          hasExitedRef.current = true;
          reset();
          router.replace('/(tabs)/home');
        }
      },
      (message) => {
        if (!cancelled) setSubscriptionError(message);
      },
    );

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

    const { error } = await cancelRideRequest(rideRequestId, 'Cancelled by passenger');

    setIsCancelling(false);

    if (error) {
      setCancelError(error);
      return;
    }

    hasExitedRef.current = true;
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
          edgeToEdge
        />
        <View style={styles.beaconWrap} pointerEvents="none">
          <PulseBeacon size={80}>
            <Ionicons name="search" size={32} color={colors.white} />
          </PulseBeacon>
        </View>
      </View>

      <MapOverlaySheet bottomInset={insets.bottom}>
        <Text style={styles.title}>{t.findingDriver.title}</Text>
        <Text style={styles.subtitle}>
          {dropoff ? `${t.findingDriver.lookingForTricycleTo} ${dropoff.label}` : t.findingDriver.lookingForTricycleNearby}
        </Text>
        {subscriptionError && <Text style={styles.cancelError}>{subscriptionError}</Text>}
        <View style={styles.cancelButton}>
          <Button
            label={t.findingDriver.cancelRequest}
            variant="outline"
            tone="neutral"
            fullWidth
            loading={isCancelling}
            disabled={isCancelling}
            onPress={handleCancel}
          />
        </View>
        {cancelError && <Text style={styles.cancelError}>{cancelError}</Text>}
      </MapOverlaySheet>
    </View>
  );
}
