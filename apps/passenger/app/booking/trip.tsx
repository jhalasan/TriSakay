import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  cancelRideRequest,
  subscribeToDriverLocation,
  subscribeToRideRequestStatus,
  type DriverLocation,
} from '@trisakay/services';
import { ASSUMED_TRICYCLE_SPEED_KMH, estimateEtaMinutes, haversineKm } from '@trisakay/shared';
import {
  Badge,
  Button,
  ConfirmModal,
  EmptyState,
  GradientSurface,
  HoldToConfirmButton,
  OsmMap,
  colors,
  motion,
  spacing,
  useTutorialTarget,
} from '@trisakay/ui';
import { DriverInfoCard } from '../../src/components/DriverInfoCard';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useTripTutorialDemo } from '../../src/hooks/useTutorialDemoState';
import { useBookingStore } from '../../src/store/useBookingStore';
import { fetchRouteEstimate, type RouteEstimate } from '../../src/utils/route';
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
  const tutorialDemo = useTripTutorialDemo();
  const driverCardTarget = useTutorialTarget('driver-card');
  const driverReal = useBookingStore((state) => state.driver);
  const driver = tutorialDemo.active ? tutorialDemo.data.driver : driverReal;
  const pickup = useBookingStore((state) => state.pickup);
  const dropoff = useBookingStore((state) => state.dropoff);
  const seatsReal = useBookingStore((state) => state.seats);
  const seats = tutorialDemo.active ? tutorialDemo.data.seats : seatsReal;
  const fareReal = useBookingStore((state) => state.fare);
  const fare = tutorialDemo.active ? tutorialDemo.data.fare : fareReal;
  const rideRequestId = useBookingStore((state) => state.rideRequestId);
  const setTripStatus = useBookingStore((state) => state.setTripStatus);
  const reset = useBookingStore((state) => state.reset);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [cancelConfirmVisible, setCancelConfirmVisible] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [rideStatus, setRideStatus] = useState<'assigned' | 'ongoing'>(
    initialStatus === 'ongoing' ? 'ongoing' : 'assigned'
  );
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  // Only fetched once the trip is actually underway — during 'assigned' the
  // map shows the driver-to-pickup line instead (drawn by OsmMap itself from
  // `liveDriverMarker`), so there's nothing for a pickup→dropoff route to add yet.
  const [tripRoute, setTripRoute] = useState<RouteEstimate | null>(null);
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
    if (hasExitedRef.current || tutorialDemo.active) return;

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

  useEffect(() => {
    if (rideStatus !== 'ongoing' || !pickup || !dropoff) {
      setTripRoute(null);
      return;
    }
    let cancelled = false;
    fetchRouteEstimate(pickup, dropoff).then((result) => {
      if (!cancelled) setTripRoute(result);
    });
    return () => {
      cancelled = true;
    };
  }, [rideStatus, pickup, dropoff]);

  const etaMinutes =
    driverLocation && pickup
      ? estimateEtaMinutes(
          haversineKm(driverLocation.lat, driverLocation.lng, pickup.latitude, pickup.longitude),
          ASSUMED_TRICYCLE_SPEED_KMH,
        )
      : null;

  /**
   * P2 (2026-09-15 launch audit): the only exit from this screen used to be
   * SOS — no way to back out of a ride once a driver was assigned. Only
   * offered before pickup (`rideStatus === 'assigned'`); once the trip is
   * `ongoing` the driver has already picked the passenger up, so "cancel"
   * no longer makes sense there (see FR-9's cash-only, no-refund design —
   * ending an in-progress ride is a driver/PSO matter, not a passenger
   * self-cancel).
   *
   * Uses the same `cancelRideRequest` call and "Cancelled by passenger"
   * reason as no-drivers-nearby.tsx's own change-pickup cancel, and
   * navigates straight to Home on success rather than through
   * ride-cancelled.tsx — that screen's copy ("This ride was cancelled…") is
   * written for a cancellation that happened *to* the passenger (by the
   * driver or the system), not one they just chose themselves.
   *
   * Known limitation: the driver app has no realtime subscription on an
   * active trip's passenger list (it only refreshes on driver-initiated
   * actions), so a driver already en route won't be notified instantly —
   * their next attempt to act on this leg will fail with a clear error
   * rather than silently succeeding against a cancelled row. A live push
   * notification to the driver here would need the same delivery
   * infrastructure as P1-12's ride-request alerts; out of scope for this fix.
   */
  async function handleCancelRide() {
    if (!rideRequestId) return;
    setCancelling(true);
    setCancelError(null);

    const { error } = await cancelRideRequest(rideRequestId, 'Cancelled by passenger');

    setCancelling(false);
    setCancelConfirmVisible(false);

    if (error) {
      setCancelError(error);
      return;
    }

    hasExitedRef.current = true;
    reset();
    router.replace('/(tabs)/home');
  }

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
          latitude={(rideStatus === 'ongoing' ? dropoff : pickup)?.latitude}
          longitude={(rideStatus === 'ongoing' ? dropoff : pickup)?.longitude}
          zoom={15}
          interactive
          edgeToEdge
          marker={
            rideStatus === 'ongoing'
              ? dropoff
                ? { latitude: dropoff.latitude, longitude: dropoff.longitude }
                : null
              : pickup
                ? { latitude: pickup.latitude, longitude: pickup.longitude }
                : null
          }
          markerColor={rideStatus === 'ongoing' ? colors.accentBlue : colors.accentGreen}
          route={rideStatus === 'ongoing' ? tripRoute?.geometry : null}
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
          <View {...driverCardTarget}>
            <DriverInfoCard driver={driverForCard} seats={seats} fare={fare} />
            {subscriptionError && <Text style={styles.error}>{subscriptionError}</Text>}
            <Text style={styles.caption}>{t.trip.noInAppCallNotice}</Text>

            <View style={styles.sosBlock}>
              <HoldToConfirmButton
                label={t.trip.sosButton}
                fullWidth
                onConfirm={() => (tutorialDemo.active ? undefined : router.push('/booking/emergency'))}
              />
              <Text style={styles.sosCaption}>{t.trip.sosCaption}</Text>
            </View>

            {rideStatus === 'assigned' && !tutorialDemo.active && (
              <View style={styles.cancelLinkWrap}>
                <Pressable onPress={() => setCancelConfirmVisible(true)} accessibilityRole="button">
                  <Text style={styles.cancelLinkText}>{t.trip.cancelRide}</Text>
                </Pressable>
                {cancelError && <Text style={styles.error}>{cancelError}</Text>}
              </View>
            )}
          </View>
        </GradientSurface>
      </Animated.View>

      <ConfirmModal
        visible={cancelConfirmVisible}
        title={t.trip.cancelRideTitle}
        message={t.trip.cancelRideMessage}
        cancelLabel={t.trip.cancelRideKeepIt}
        confirmLabel={t.trip.cancelRideConfirm}
        destructive
        confirmLoading={cancelling}
        onCancel={() => setCancelConfirmVisible(false)}
        onConfirm={handleCancelRide}
      />
    </View>
  );
}
