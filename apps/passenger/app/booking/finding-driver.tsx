import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  cancelRideRequest,
  getNearbyDriverCount,
  getTripDriverInfo,
  subscribeToRideRequestStatus,
  type TripDriverInfo,
} from '@trisakay/services';
import { Button, MapOverlaySheet, OsmMap, colors } from '@trisakay/ui';
import { PulseBeacon } from '../../src/components/PulseBeacon';
import { useBookingStore } from '../../src/store/useBookingStore';
import { useTranslation } from '../../src/hooks/useTranslation';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/booking/finding-driver.styles';

/** No documented figure for this — a reasonable upper bound before telling the rider nobody's picking up the request. */
const SEARCH_TIMEOUT_MS = 60_000;

export default function FindingDriverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const pickup = useBookingStore((state) => state.pickup);
  const dropoff = useBookingStore((state) => state.dropoff);
  const seats = useBookingStore((state) => state.seats);
  const fare = useBookingStore((state) => state.fare);
  const rideRequestId = useBookingStore((state) => state.rideRequestId);
  const setTripStatus = useBookingStore((state) => state.setTripStatus);
  const setDriver = useBookingStore((state) => state.setDriver);
  const reset = useBookingStore((state) => state.reset);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [nearbyCount, setNearbyCount] = useState<number | null>(null);
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

    const searchTimeout = setTimeout(() => {
      if (cancelled || hasExitedRef.current) return;
      hasExitedRef.current = true;
      router.replace('/booking/no-drivers-nearby');
    }, SEARCH_TIMEOUT_MS);

    const applyDriverAndAdvance = (data?: TripDriverInfo | null) => {
      if (cancelled) return;
      setDriver({
        id: data?.driverId ?? '',
        name: data?.driverName ?? '',
        plateNumber: data?.plateNo ?? '',
        rating: data?.ratingAvg ?? null,
        // Intentionally null here, not an oversight: getTripDriverInfo doesn't
        // fetch the driver's location, and trip.tsx computes a live straight-
        // line ETA once its tracking subscription delivers a position.
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
          clearTimeout(searchTimeout);
          getTripDriverInfo(row.id)
            .then(({ data }) => applyDriverAndAdvance(data))
            .catch(() => applyDriverAndAdvance());
        } else if (row.status === 'cancelled') {
          hasExitedRef.current = true;
          clearTimeout(searchTimeout);
          router.replace({
            pathname: '/booking/ride-cancelled',
            params: {
              byDriver: row.cancel_reason?.toLowerCase().includes('driver') ? '1' : '0',
              discountApplied: row.discount_applied ? '1' : '0',
            },
          });
        }
      },
      (message) => {
        if (!cancelled) setSubscriptionError(message);
      },
    );

    return () => {
      cancelled = true;
      clearTimeout(searchTimeout);
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideRequestId]);

  useEffect(() => {
    if (!pickup) return;
    let cancelled = false;
    getNearbyDriverCount(pickup.latitude, pickup.longitude).then((result) => {
      if (!cancelled) setNearbyCount(result.count);
    });
    return () => {
      cancelled = true;
    };
  }, [pickup]);

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
          <PulseBeacon size={56}>
            <Ionicons name="search" size={26} color={colors.white} />
          </PulseBeacon>
        </View>
      </View>

      <MapOverlaySheet bottomInset={insets.bottom}>
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowDots}>
            <View style={styles.eyebrowDot} />
            <View style={styles.eyebrowDot} />
            <View style={styles.eyebrowDot} />
          </View>
          <Text style={styles.eyebrowLabel}>{t.findingDriver.searchingNearbyEyebrow}</Text>
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{t.findingDriver.title}</Text>
          <Text style={styles.subtitle}>
            {dropoff ? `${t.findingDriver.lookingForTricycleTo} ${dropoff.label}` : t.findingDriver.lookingForTricycleNearby}
          </Text>
        </View>
        {nearbyCount != null && (
          <View style={styles.infoRow}>
            <View style={styles.infoIconTile}>
              <Ionicons name="navigate" size={18} color={colors.accentBluePressed} />
            </View>
            <View style={styles.infoTextSlot}>
              <Text style={styles.infoTitle}>
                {t.findingDriver.tricyclesNearby.replace('{count}', String(nearbyCount))}
              </Text>
              {fare !== null && (
                <Text style={styles.infoSubtitle}>
                  {t.findingDriver.fareHeld.replace('{fare}', formatCurrency(fare)).replace('{seats}', String(seats))}
                </Text>
              )}
            </View>
          </View>
        )}
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
