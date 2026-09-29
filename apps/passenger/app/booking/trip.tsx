import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  cancelRideRequest,
  getTripDriverInfo,
  listMessages,
  subscribeToDriverLocation,
  subscribeToRideRequestStatus,
  type DriverLocation,
} from '@trisakay/services';
import { ASSUMED_TRICYCLE_SPEED_KMH, PASSENGER_CANCEL_REASON_CODES, estimateEtaMinutes, haversineKm } from '@trisakay/shared';
import {
  Badge,
  Button,
  EmptyState,
  GradientSurface,
  HoldToConfirmButton,
  OsmMap,
  ReasonPickerModal,
  colors,
  motion,
  spacing,
  useTutorialTarget,
} from '@trisakay/ui';
import { Ionicons } from '@expo/vector-icons';
import { DriverInfoCard } from '../../src/components/DriverInfoCard';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
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
  const setDriver = useBookingStore((state) => state.setDriver);
  const reset = useBookingStore((state) => state.reset);
  const user = useAuthStore((state) => state.user);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [newDriverNotice, setNewDriverNotice] = useState<string | null>(null);
  // C1 — a one-shot count, not a live subscription: the full live thread
  // only opens once the passenger actually taps into booking/chat, which
  // owns its own subscription lifecycle (useChatStore.connect/disconnect).
  // Refetched whenever this screen regains focus isn't built here — this is
  // enough to surface "you have unread messages" without a second
  // long-lived Realtime channel duplicating chat.tsx's own.
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  useEffect(() => {
    if (!rideRequestId || !user || tutorialDemo.active) return;
    let cancelled = false;
    listMessages(rideRequestId).then(({ data }) => {
      if (cancelled) return;
      setUnreadMessageCount(data.filter((m) => m.senderId !== user.id && m.readAt === null).length);
    });
    return () => {
      cancelled = true;
    };
  }, [rideRequestId, user, tutorialDemo.active]);
  // D1 (UAT audit): tracks the trip_id this screen last saw so a transfer —
  // which changes trip_id without changing status — can be detected. null
  // means "not seen yet"; the very first status event seeds it without
  // treating that as a transfer.
  const lastTripIdRef = useRef<string | null | undefined>(undefined);
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
    lastTripIdRef.current = undefined;

    const unsubscribe = subscribeToRideRequestStatus(
      rideRequestId,
      (row) => {
        if (cancelled || hasExitedRef.current) return;

        // D1 (UAT audit): a transfer switches trip_id without changing
        // status (before pickup it stays 'assigned', after pickup 'ongoing'),
        // so this is the only signal this screen gets that the driver
        // changed. The first event just seeds the ref — it's the ride's
        // normal starting trip_id, not a transfer.
        if (row.status === 'assigned' || row.status === 'ongoing') {
          if (lastTripIdRef.current !== undefined && lastTripIdRef.current !== row.trip_id) {
            getTripDriverInfo(rideRequestId).then(({ data }) => {
              if (cancelled || !data) return;
              setDriver({
                id: data.driverId,
                name: data.driverName ?? '',
                plateNumber: data.plateNo ?? '',
                rating: data.ratingAvg,
                etaMinutes: null,
                avatarUrl: data.avatarUrl,
              });
              setNewDriverNotice(t.trip.newDriverNotice);
              setTimeout(() => setNewDriverNotice(null), 6000);
            });
          }
          lastTripIdRef.current = row.trip_id;
        }

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
              byDriver: row.cancelled_by === 'driver' ? '1' : '0',
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
   * PD1 (UAT audit): this is the 'assigned'-stage cancel, so a reasonCode is
   * mandatory — the server rejects a null one at this stage. Navigates
   * straight to Home on success rather than through ride-cancelled.tsx —
   * that screen's copy ("This ride was cancelled…") is written for a
   * cancellation that happened *to* the passenger (by the driver or the
   * system), not one they just chose themselves.
   *
   * Known limitation: the driver app has no realtime subscription on an
   * active trip's passenger list (it only refreshes on driver-initiated
   * actions), so a driver already en route won't be notified instantly —
   * their next attempt to act on this leg will fail with a clear error
   * rather than silently succeeding against a cancelled row. A live push
   * notification to the driver here would need the same delivery
   * infrastructure as P1-12's ride-request alerts; out of scope for this fix.
   */
  async function handleCancelRide(reasonCode: string) {
    if (!rideRequestId) return;
    setCancelling(true);
    setCancelError(null);

    const { error } = await cancelRideRequest(rideRequestId, reasonCode);

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
          // Matches the navy sheet below (content-driven height: driver card +
          // SOS button + notices) — without this the recenter button ends up
          // hidden underneath it once the rider pans the map. Same pattern as
          // apps/driver/app/trip/active.tsx.
          bottomInset={340}
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
            {newDriverNotice && <Text style={styles.caption}>{newDriverNotice}</Text>}
            <Pressable
              style={styles.messageDriverRow}
              accessibilityRole="button"
              accessibilityLabel={t.trip.messageDriver}
              onPress={() => (tutorialDemo.active ? undefined : router.push('/booking/chat'))}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.white} />
              <Text style={styles.messageDriverText}>{t.trip.messageDriver}</Text>
              {unreadMessageCount > 0 && <View style={styles.messageDriverDot} />}
            </Pressable>

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

      <ReasonPickerModal
        visible={cancelConfirmVisible}
        title={t.trip.cancelRideTitle}
        message={t.trip.cancelRideMessage}
        options={PASSENGER_CANCEL_REASON_CODES.map((code) => ({ code, label: t.trip.cancelReasons[code] }))}
        cancelLabel={t.trip.cancelRideKeepIt}
        confirmLabel={t.trip.cancelRideConfirm}
        confirmLoading={cancelling}
        onCancel={() => setCancelConfirmVisible(false)}
        onConfirm={handleCancelRide}
      />
    </View>
  );
}
