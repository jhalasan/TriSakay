import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Animated, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { subscribeToDriverLocation, subscribeToRideRequestStatus, type DriverLocation } from '@trisakay/services';
import { ASSUMED_TRICYCLE_SPEED_KMH, estimateEtaMinutes, haversineKm } from '@trisakay/shared';
import { Badge, Button, EmptyState, GradientSurface, HoldToConfirmButton, OsmMap, motion, spacing } from '@trisakay/ui';
import { DriverInfoCard } from '../../src/components/DriverInfoCard';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useBookingStore } from '../../src/store/useBookingStore';
import { styles } from '../../src/styles/booking/trip.styles';

export default function TripScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  // Seeded by splash.tsx's mid-ride rehydrate path when the passenger's
  // ride was already 'ongoing' on app restart — without this, a rehydrated
  // in-progress ride would wrongly start back at the live-tracking UI
  // instead of the trip-in-progress UI. Absent (undefined) on the normal
  // arrival from finding-driver.tsx, where a freshly matched ride is always
  // 'assigned'.
  const { status: initialStatus } = useLocalSearchParams<{ status?: 'assigned' | 'ongoing' }>();
  const driver = useBookingStore((state) => state.driver);
  const pickup = useBookingStore((state) => state.pickup);
  const seats = useBookingStore((state) => state.seats);
  const fare = useBookingStore((state) => state.fare);
  const rideRequestId = useBookingStore((state) => state.rideRequestId);
  const setTripStatus = useBookingStore((state) => state.setTripStatus);
  const reset = useBookingStore((state) => state.reset);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [rideStatus, setRideStatus] = useState<'assigned' | 'ongoing'>(
    initialStatus === 'ongoing' ? 'ongoing' : 'assigned'
  );
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  // Same exit-guard pattern as finding-driver.tsx: reset() clears
  // rideRequestId, which would otherwise re-fire this effect a second time
  // before the component finishes unmounting from the first navigate-away.
  const hasExitedRef = useRef(false);

  /** Same settle-in entrance used when this screen previously arrived from finding-driver. */
  const settle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(settle, {
      toValue: 1,
      duration: motion.duration.settle,
      easing: motion.easing.out,
      useNativeDriver: true,
    }).start();
  }, [settle]);

  useEffect(() => {
    if (hasExitedRef.current) return;

    if (!rideRequestId) {
      hasExitedRef.current = true;
      reset();
      router.replace('/(tabs)/home');
      return;
    }

    let cancelled = false;

    const unsubscribe = subscribeToRideRequestStatus(
      rideRequestId,
      (row) => {
        if (cancelled || hasExitedRef.current) return;
        if (row.status === 'ongoing') {
          setRideStatus('ongoing');
        } else if (row.status === 'completed') {
          hasExitedRef.current = true;
          setTripStatus('awaiting_payment');
          router.replace('/booking/payment');
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
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideRequestId]);

  useEffect(() => {
    if (rideStatus !== 'assigned' || !driver?.id) {
      setDriverLocation(null);
      return;
    }
    const unsubscribe = subscribeToDriverLocation(driver.id, setDriverLocation);
    return unsubscribe;
  }, [rideStatus, driver?.id]);

  const etaMinutes =
    driverLocation && pickup
      ? estimateEtaMinutes(
          haversineKm(driverLocation.lat, driverLocation.lng, pickup.latitude, pickup.longitude),
          ASSUMED_TRICYCLE_SPEED_KMH,
        )
      : null;

  if (!driver) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyWrap}>
          <EmptyState title={t.trip.noDriverMatchedTitle} message={t.trip.noDriverMatchedMessage} />
          <Button label={t.trip.backToHome} onPress={() => router.replace('/(tabs)/home')} />
        </View>
      </View>
    );
  }

  const driverForCard = { ...driver, etaMinutes };

  return (
    <View style={styles.container}>
      <View style={styles.mapFill}>
        <OsmMap
          variant="route"
          caption={rideStatus === 'assigned' ? t.trip.mapCaption : t.trip.tripInProgressCaption}
          height="100%"
          latitude={pickup?.latitude}
          longitude={pickup?.longitude}
          zoom={15}
          interactive
          edgeToEdge
          marker={pickup ? { latitude: pickup.latitude, longitude: pickup.longitude } : null}
          liveDriverMarker={
            rideStatus === 'assigned' && driverLocation
              ? { latitude: driverLocation.lat, longitude: driverLocation.lng }
              : null
          }
        />
      </View>

      <View style={styles.statusBadgeWrap}>
        <Badge label={rideStatus === 'assigned' ? t.trip.driverAssigned : t.trip.tripInProgress} tone="blue" dot />
      </View>

      <Animated.View
        style={[
          styles.sheetShadowWrap,
          {
            opacity: settle,
            transform: [
              { translateY: settle.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
            ],
          },
        ]}
      >
        <GradientSurface
          token="hero"
          direction="diagonal"
          style={[styles.sheet, { paddingBottom: spacing.xl + insets.bottom }]}
        >
          <View style={styles.sheetHandle} />
          <DriverInfoCard driver={driverForCard} seats={seats} fare={fare} />
          {subscriptionError && <Text style={styles.error}>{subscriptionError}</Text>}
          <Text style={styles.caption}>{t.trip.noInAppCallNotice}</Text>

          <View style={styles.sosBlock}>
            <HoldToConfirmButton
              label={t.trip.sosButton}
              fullWidth
              onConfirm={() => router.push('/booking/emergency')}
            />
            <Text style={styles.sosCaption}>{t.trip.sosCaption}</Text>
          </View>
        </GradientSurface>
      </Animated.View>
    </View>
  );
}
