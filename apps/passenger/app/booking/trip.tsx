import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Animated, Pressable, ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ReAnimated, { Easing, interpolateColor, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  cancelRideRequest,
  getTripDriverInfo,
  getTransactionStatus,
  listMessages,
  startRideCall,
  subscribeToDriverLocation,
  subscribeToRideRequestStatus,
  type DriverLocation,
} from '@trisakay/services';
import { ASSUMED_TRICYCLE_SPEED_KMH, PASSENGER_CANCEL_REASON_CODES, estimateEtaMinutes, features, haversineKm } from '@trisakay/shared';
import { Avatar, Button, ChatPreviewBanner, EmptyState, HoldToConfirmButton, OsmMap, colors, motion, useNavigationRoute, useTutorialTarget } from '@trisakay/ui';
import { Ionicons } from '@expo/vector-icons';
import { CancelReasonSheet } from '../../src/components/CancelReasonSheet';
import { useChatPreviewBanner } from '../../src/hooks/useChatPreviewBanner';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useTripTutorialDemo } from '../../src/hooks/useTutorialDemoState';
import { useBookingStore } from '../../src/store/useBookingStore';
import { formatCurrency } from '../../src/utils/currency';
import { interpolate } from '../../src/utils/interpolate';
import { shouldOpenPaymentScreen } from '../../src/utils/paymentRoute';
import { fetchRouteEstimate, type RouteEstimate } from '../../src/utils/route';
import { styles } from '../../src/styles/booking/trip.styles';

async function fetchRouteForNavigation(origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }) {
  const { geometry, source } = await fetchRouteEstimate(origin, destination);
  return { geometry, source };
}

// Hoisted so the worklet below captures plain strings, not the whole `colors` object.
const HANDLE_COLOR = colors.lineStrong;
const HANDLE_COLOR_PRESSED = colors.inkSoft;
// Reanimated's own Easing (the shared motion.easing token isn't worklet-safe); same curve as motion.easing.out.
const HANDLE_EASING = Easing.bezier(0.16, 1, 0.3, 1);

/** How much of the ride card stays showing when collapsed: just the drag handle. */
const SHEET_PEEK_HEIGHT = 28;
/** Seed for the card's height before it has been measured; matches the map's bottomInset. */
const SHEET_EXPANDED_GUESS = 340;
/** A flick faster than this (px/s) snaps in that direction regardless of how far it was dragged. */
const SHEET_FLING_VELOCITY = 500;

type Stage = 1 | 2 | 3;

function firstNameOf(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function pickupShort(label: string) {
  return label.split(',')[0].trim();
}

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
  const paymentMethod = useBookingStore((state) => state.paymentMethod);
  const rideRequestId = useBookingStore((state) => state.rideRequestId);
  const setTripStatus = useBookingStore((state) => state.setTripStatus);
  const setPaymentMethod = useBookingStore((state) => state.setPaymentMethod);
  const setDriver = useBookingStore((state) => state.setDriver);
  const reset = useBookingStore((state) => state.reset);
  const user = useAuthStore((state) => state.user);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [transferBannerVisible, setTransferBannerVisible] = useState(false);
  // Payment settlement: the driver asks for payment while the ride is still going, and can switch a GCash ride to cash.
  const [paymentRequested, setPaymentRequested] = useState(false);
  const [paymentPaid, setPaymentPaid] = useState(false);
  const [paymentSwitchedVisible, setPaymentSwitchedVisible] = useState(false);
  const paymentOpenedRef = useRef(false);

  // C1 — a per-ride unread count for the Message button, not a live
  // subscription: the full live thread only opens once the passenger taps
  // into booking/chat, which owns its own subscription lifecycle
  // (useChatStore.connect/disconnect). Refetches on every return to this
  // screen's focus (Part B §B4.2), which is what clears the badge after
  // reading a thread and tapping back.
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (!rideRequestId || !user || tutorialDemo.active) return;
      let cancelled = false;
      listMessages(rideRequestId).then(({ data }) => {
        if (cancelled) return;
        setUnreadMessageCount(data.filter((m) => m.senderId !== user.id && m.readAt === null).length);
      });
      return () => {
        cancelled = true;
      };
    }, [rideRequestId, user, tutorialDemo.active])
  );

  const { preview, dismiss: dismissPreview } = useChatPreviewBanner(tutorialDemo.active ? null : rideRequestId, user?.id);

  // The focus refetch above only runs when the screen comes back into view, so a
  // message arriving while it is open would leave the Message button unlit. The
  // preview banner is live; recount on each new message so the button lights up at once.
  useEffect(() => {
    if (!preview || !rideRequestId || !user) return;
    let cancelled = false;
    listMessages(rideRequestId).then(({ data }) => {
      if (cancelled) return;
      setUnreadMessageCount(data.filter((m) => m.senderId !== user.id && m.readAt === null).length);
    });
    return () => {
      cancelled = true;
    };
  }, [preview, rideRequestId, user]);

  // D1 (UAT audit): tracks the trip_id this screen last saw so a transfer —
  // which changes trip_id without changing status — can be detected. null
  // means "not seen yet"; the very first status event seeds it without
  // treating that as a transfer.
  const lastTripIdRef = useRef<string | null | undefined>(undefined);
  const [cancelSheetVisible, setCancelSheetVisible] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [rideStatus, setRideStatus] = useState<'assigned' | 'ongoing'>(
    initialStatus === 'ongoing' ? 'ongoing' : 'assigned'
  );
  const [arrivedAt, setArrivedAt] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  // Only fetched once the trip is actually underway — during 'assigned' the
  // map shows the driver-to-pickup line instead (drawn by OsmMap itself from
  // `liveDriverMarker`), so there's nothing for a pickup→dropoff route to add yet.
  const [tripRoute, setTripRoute] = useState<RouteEstimate | null>(null);
  // The passenger's own phone position while riding: it is in the vehicle, and its GPS is smoother than the driver's ~8 s server updates.
  const [ridePosition, setRidePosition] = useState<{ latitude: number; longitude: number; heading: number | null } | null>(null);
  // Same exit-guard pattern as finding-driver.tsx: reset() clears
  // rideRequestId, which would otherwise re-fire this effect a second time
  // before the component finishes unmounting from the first navigate-away.
  const hasExitedRef = useRef(false);

  /** Same settle-in entrance used when this screen previously arrived from finding-driver. */
  const settle = useRef(new Animated.Value(0)).current;

  // Drag the handle down to collapse the ride card to a peek (so the map is
  // fully visible), drag up or tap to bring it back. `sheetHeight` is the
  // measured card height, `sheetOffset` how far it is slid down (0 = open).
  const sheetHeight = useSharedValue(SHEET_EXPANDED_GUESS);
  const sheetOffset = useSharedValue(0);
  const dragStartOffset = useSharedValue(0);
  /** 0 = resting, 1 = the handle is under a finger. */
  const handlePressed = useSharedValue(0);
  const sheetAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetOffset.value }] }));
  // What the map's recenter button sits above: the card's visible height.
  const mapInset = useDerivedValue(() => Math.max(SHEET_PEEK_HEIGHT, sheetHeight.value - sheetOffset.value) + 10);
  const sheetGesture = Gesture.Exclusive(
    Gesture.Pan()
      // onBegin/onFinalize fire on touch down and release, even for a tap that never becomes a drag,
      // so the handle lights up as soon as it is touched (same as the driver's ride card).
      .onBegin(() => {
        handlePressed.value = withTiming(1, { duration: motion.duration.instant, easing: HANDLE_EASING });
      })
      .onFinalize(() => {
        handlePressed.value = withTiming(0, { duration: motion.duration.quick, easing: HANDLE_EASING });
      })
      .onStart(() => {
        dragStartOffset.value = sheetOffset.value;
      })
      .onUpdate((event) => {
        const max = Math.max(0, sheetHeight.value - SHEET_PEEK_HEIGHT);
        sheetOffset.value = Math.min(max, Math.max(0, dragStartOffset.value + event.translationY));
      })
      .onEnd((event) => {
        const max = Math.max(0, sheetHeight.value - SHEET_PEEK_HEIGHT);
        const collapse = Math.abs(event.velocityY) > SHEET_FLING_VELOCITY ? event.velocityY > 0 : sheetOffset.value > max / 2;
        sheetOffset.value = withTiming(collapse ? max : 0, { duration: 250 });
      }),
    Gesture.Tap().onEnd(() => {
      const max = Math.max(0, sheetHeight.value - SHEET_PEEK_HEIGHT);
      sheetOffset.value = withTiming(sheetOffset.value > 0 ? 0 : max, { duration: 250 });
    }),
  );
  // Darkens and widens the grip while held.
  const animatedHandleStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(handlePressed.value, [0, 1], [HANDLE_COLOR, HANDLE_COLOR_PRESSED]),
    transform: [{ scaleX: 1 + handlePressed.value * 0.15 }],
  }));
  const handleSheetLayout = (event: LayoutChangeEvent) => {
    sheetHeight.value = event.nativeEvent.layout.height;
  };

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
                ratingCount: data.ratingCount,
                psoVerified: data.psoVerified,
              });
              setTransferBannerVisible(true);
            });
          }
          lastTripIdRef.current = row.trip_id;
        }

        setArrivedAt(row.arrived_at);

        // Part B §B6 — the transfer banner and the driver's "New" tag both
        // clear once the second stage (arrived at pickup) starts, not just
        // on a fixed timer.
        if (row.arrived_at) setTransferBannerVisible(false);

        // The driver may switch a GCash ride to cash mid-ride: follow the server's method and say so.
        const previousMethod = useBookingStore.getState().paymentMethod;
        if (row.preferred_method && row.preferred_method !== previousMethod) {
          setPaymentMethod(row.preferred_method);
          if (previousMethod === 'gcash' && row.preferred_method === 'cash') {
            setPaymentSwitchedVisible(true);
            setPaymentRequested(false);
          }
        }

        if (row.status === 'ongoing') {
          setRideStatus('ongoing');
          if (shouldOpenPaymentScreen(row)) {
            setPaymentRequested(true);
            getTransactionStatus(rideRequestId).then(({ status }) => {
              if (cancelled) return;
              if (status === 'paid') {
                setPaymentPaid(true);
              } else if (!paymentOpenedRef.current) {
                paymentOpenedRef.current = true;
                router.push('/booking/payment');
              }
            });
          }
        } else if (row.status === 'completed') {
          hasExitedRef.current = true;
          // Normally already paid (the driver could not complete otherwise); an unpaid completed ride goes to the payment screen as before.
          getTransactionStatus(rideRequestId).then(({ status }) => {
            if (status === 'paid') {
              setTripStatus('paid');
              router.replace('/booking/trip-complete');
            } else {
              setTripStatus('awaiting_payment');
              router.replace('/booking/payment');
            }
          });
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
      () => {
        if (!cancelled) setSubscriptionError(null);
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideRequestId]);

  useEffect(() => {
    // Heading to the pickup, and during the ride (as the fallback position if this phone has no GPS fix).
    const wanted = (rideStatus === 'assigned' && !arrivedAt) || rideStatus === 'ongoing';
    if (!wanted || !driver?.id) {
      setDriverLocation(null);
      return;
    }
    const unsubscribe = subscribeToDriverLocation(driver.id, setDriverLocation);
    return unsubscribe;
  }, [rideStatus, arrivedAt, driver?.id]);

  // While riding, follow this phone's own GPS so the map moves smoothly with the vehicle.
  useEffect(() => {
    if (rideStatus !== 'ongoing') {
      setRidePosition(null);
      return;
    }
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    void (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 8, timeInterval: 2000 },
        ({ coords }) => {
          setRidePosition((previous) => ({
            latitude: coords.latitude,
            longitude: coords.longitude,
            // GPS heading is noise when barely moving, so keep the last real one.
            heading: typeof coords.heading === 'number' && coords.heading >= 0 && (coords.speed ?? 0) >= 1 ? coords.heading : (previous?.heading ?? null),
          }));
        },
      );
      if (cancelled) sub.remove();
      else subscription = sub;
    })();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [rideStatus]);

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

  // While the driver is on the way, draw the road they'll take to the pickup
  // (trimmed as they drive) instead of a straight line.
  const approach = useNavigationRoute({
    origin: rideStatus === 'assigned' && driverLocation ? { latitude: driverLocation.lat, longitude: driverLocation.lng } : null,
    destination: rideStatus === 'assigned' && pickup ? pickup : null,
    fetchRoute: fetchRouteForNavigation,
  });

  // During the ride: the road ahead from where the vehicle is now, trimmed as it moves.
  const ridePoint =
    rideStatus === 'ongoing'
      ? ridePosition ?? (driverLocation ? { latitude: driverLocation.lat, longitude: driverLocation.lng, heading: null } : null)
      : null;
  const rideNav = useNavigationRoute({
    origin: ridePoint ? { latitude: ridePoint.latitude, longitude: ridePoint.longitude } : null,
    destination: rideStatus === 'ongoing' && dropoff ? dropoff : null,
    fetchRoute: fetchRouteForNavigation,
  });

  // Auto-close the cancel sheet if the ride moves to 'ongoing' while it's open (Part B §B5).
  useEffect(() => {
    if (rideStatus === 'ongoing') setCancelSheetVisible(false);
  }, [rideStatus]);

  const etaToPickupMinutes =
    driverLocation && pickup
      ? estimateEtaMinutes(haversineKm(driverLocation.lat, driverLocation.lng, pickup.latitude, pickup.longitude), ASSUMED_TRICYCLE_SPEED_KMH)
      : null;
  // Distance still to go: along the remaining road once the vehicle's position is known, else the whole trip.
  const remainingRideKm = rideNav.route
    ? rideNav.route.slice(1).reduce((sum, point, i) => sum + haversineKm(rideNav.route![i].latitude, rideNav.route![i].longitude, point.latitude, point.longitude), 0)
    : (tripRoute?.distanceKm ?? null);
  const etaToDropoffMinutes = remainingRideKm !== null ? estimateEtaMinutes(remainingRideKm, ASSUMED_TRICYCLE_SPEED_KMH) : null;

  const stage: Stage = rideStatus === 'ongoing' ? 3 : arrivedAt ? 2 : 1;

  async function handleCall() {
    if (tutorialDemo.active || !rideRequestId) return;
    const { data: callId, error } = await startRideCall(rideRequestId);
    if (error || !callId) {
      Alert.alert(t.callUi.cannotStartTitle, error ?? '');
      return;
    }
    router.push({ pathname: '/booking/call', params: { callId } });
  }

  /**
   * P2 (2026-09-15 launch audit): the only exit from this screen used to be
   * SOS — no way to back out of a ride once a driver was assigned. Only
   * offered before pickup (stages 1-2); once the trip is `ongoing` the
   * driver has already picked the passenger up, so "cancel" no longer makes
   * sense there (see FR-9's cash-only, no-refund design — ending an
   * in-progress ride is a driver/PSO matter, not a passenger self-cancel).
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

    if (error) {
      setCancelError(error);
      return;
    }

    setCancelSheetVisible(false);
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

  const name = firstNameOf(driver.name);

  const pillDot: string = stage === 2 ? colors.accentGreen : colors.accentBlue;
  const pillText = stage === 1 ? t.trip.pill.onTheWay : stage === 2 ? t.trip.pill.here : t.trip.pill.riding;

  let eyebrow: string;
  let headline: string;
  let sub: string;
  if (stage === 1) {
    eyebrow = t.trip.eyebrow.arrivingIn;
    headline = etaToPickupMinutes === null ? t.trip.headline.onTheWay : etaToPickupMinutes < 1 ? t.trip.headline.lessThanMin : interpolate(t.trip.headline.minutes, { n: etaToPickupMinutes });
    sub =
      driverLocation && pickup
        ? interpolate(t.trip.sub.onTheWay, { name, km: haversineKm(driverLocation.lat, driverLocation.lng, pickup.latitude, pickup.longitude).toFixed(1), pickup: pickup ? pickupShort(pickup.label) : '' })
        : '';
  } else if (stage === 2) {
    eyebrow = t.trip.eyebrow.atPickup;
    headline = t.trip.headline.here;
    sub = interpolate(t.trip.sub.here, { plate: driver.plateNumber, pickup: pickup ? pickupShort(pickup.label) : '' });
  } else {
    eyebrow = t.trip.eyebrow.arrivingDropoff;
    headline = etaToDropoffMinutes === null ? t.trip.headline.onTheWay : etaToDropoffMinutes < 1 ? t.trip.headline.lessThanMin : interpolate(t.trip.headline.minutes, { n: etaToDropoffMinutes });
    sub = remainingRideKm !== null ? interpolate(t.trip.sub.riding, { dropoff: dropoff?.label ?? '', km: remainingRideKm.toFixed(1) }) : '';
  }

  const step = stage - 1;

  const payLine =
    paymentMethod === 'gcash'
      ? seats === 1
        ? t.trip.pay.gcashSeat
        : interpolate(t.trip.pay.gcashSeats, { n: seats })
      : stage === 3
        ? t.trip.pay.cashOnArrival
        : seats === 1
          ? t.trip.pay.cashSeat
          : interpolate(t.trip.pay.cashSeats, { n: seats });

  const cancelBody = stage === 1 ? interpolate(t.trip.cancelSheet.bodyOnTheWay, { name }) : interpolate(t.trip.cancelSheet.bodyHere, { name });

  return (
    <View style={styles.container}>
      <View style={styles.mapFill}>
        <OsmMap
          variant="route"
          height="100%"
          latitude={(stage === 3 ? dropoff : pickup)?.latitude}
          longitude={(stage === 3 ? dropoff : pickup)?.longitude}
          zoom={15}
          interactive
          edgeToEdge
          bottomInset={340}
          bottomInsetValue={mapInset}
          marker={
            stage === 3
              ? dropoff
                ? { latitude: dropoff.latitude, longitude: dropoff.longitude }
                : null
              : pickup
                ? { latitude: pickup.latitude, longitude: pickup.longitude }
                : null
          }
          markerColor={stage === 3 ? colors.accentBlue : colors.accentGreen}
          route={stage === 3 ? (rideNav.route ?? tripRoute?.geometry) : stage === 1 ? approach.route : null}
          followPosition={stage === 3 && ridePoint ? ridePoint : null}
          followZoom={16}
          followPitch={20}
          liveDriverMarker={stage === 1 && driverLocation ? { latitude: driverLocation.lat, longitude: driverLocation.lng } : null}
        />
      </View>

      <View style={[styles.statusPillWrap, { top: insets.top + 16 }]}>
        <View style={styles.statusPill}>
          <View style={[styles.statusDot, { backgroundColor: pillDot }]} />
          <Text numberOfLines={1} style={styles.statusPillText}>
            {pillText}
          </Text>
        </View>
      </View>

      <View style={[styles.sosWrap, { top: insets.top + 10 }]}>
        <HoldToConfirmButton
          variant="fab"
          label={t.trip.sosShortLabel}
          icon={<Ionicons name="warning" size={18} color={colors.white} />}
          onConfirm={() => (tutorialDemo.active ? undefined : router.push('/booking/emergency'))}
        />
        <View style={styles.sosChip}>
          <Text style={styles.sosChipText}>{t.trip.sosHold}</Text>
        </View>
      </View>

      {preview && (
        <ChatPreviewBanner
          title={name}
          avatarUrl={driver.avatarUrl}
          previewText={preview.kind === 'image' ? t.chat.photo : preview.kind === 'quick_reply' ? ((t.chat.quickReplies as Record<string, string>)[preview.body ?? ''] ?? preview.body ?? '') : (preview.body ?? '')}
          isPhoto={preview.kind === 'image'}
          replyLabel={t.trip.messagePreviewReply}
          topOffset={insets.top + 76}
          onPress={() => {
            dismissPreview();
            router.push('/booking/chat');
          }}
        />
      )}

      <Animated.View
        style={[
          styles.sheetWrap,
          {
            bottom: 10 + insets.bottom,
            opacity: settle,
            transform: [{ translateY: settle.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
          },
        ]}
      >
        <ReAnimated.View style={sheetAnimatedStyle}>
        <View style={styles.sheet} onLayout={handleSheetLayout}>
          <GestureDetector gesture={sheetGesture}>
            <View
              style={styles.handleTouch}
              hitSlop={{ top: 8, bottom: 8, left: 32, right: 32 }}
              accessibilityRole="button"
              accessibilityLabel={t.trip.sheetToggleA11y}
            >
              <ReAnimated.View style={[styles.handle, animatedHandleStyle]} />
            </View>
          </GestureDetector>
          <ScrollView contentContainerStyle={styles.sheetScrollContent} showsVerticalScrollIndicator={false}>
            {paymentSwitchedVisible && (
              <View style={styles.transferBanner}>
                <Ionicons name="cash-outline" size={20} color={colors.accentBlue} />
                <View style={styles.transferTextCol}>
                  <Text style={styles.transferTitle}>{t.payment.switchedToCashTitle}</Text>
                  <Text style={styles.transferBody}>{t.payment.switchedToCashBody}</Text>
                </View>
                <Pressable accessibilityRole="button" style={styles.transferDismiss} onPress={() => setPaymentSwitchedVisible(false)}>
                  <Ionicons name="close" size={14} color={colors.inkSoft} />
                </Pressable>
              </View>
            )}

            {paymentRequested && !paymentPaid && paymentMethod === 'gcash' && rideStatus === 'ongoing' && (
              <Pressable accessibilityRole="button" style={styles.transferBanner} onPress={() => router.push('/booking/payment')}>
                <Ionicons name="wallet-outline" size={20} color={colors.accentBlue} />
                <View style={styles.transferTextCol}>
                  <Text style={styles.transferTitle}>{t.payment.title}</Text>
                  <Text style={styles.transferBody}>{t.payment.midRideNote}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.inkSoft} />
              </Pressable>
            )}

            {paymentPaid && (
              <View style={styles.transferBanner}>
                <Ionicons name="checkmark-circle" size={20} color={colors.accentGreen} />
                <View style={styles.transferTextCol}>
                  <Text style={styles.transferBody}>{t.payment.paidMidRide}</Text>
                </View>
              </View>
            )}

            {transferBannerVisible && (
              <View style={styles.transferBanner}>
                <Ionicons name="swap-horizontal" size={20} color={colors.accentBlue} />
                <View style={styles.transferTextCol}>
                  <Text style={styles.transferTitle}>{t.trip.transfer.title}</Text>
                  <Text style={styles.transferBody}>{interpolate(t.trip.transfer.body, { name })}</Text>
                </View>
                <Pressable accessibilityRole="button" style={styles.transferDismiss} onPress={() => setTransferBannerVisible(false)}>
                  <Ionicons name="close" size={14} color={colors.inkSoft} />
                </Pressable>
              </View>
            )}

            <View style={styles.statusBlock}>
              <View style={styles.statusTextCol}>
                <Text style={styles.eyebrow}>{eyebrow}</Text>
                <Text style={styles.headline}>{headline}</Text>
                {!!sub && <Text style={styles.sub}>{sub}</Text>}
              </View>
              {stage === 2 && (
                <View style={styles.checkTile}>
                  <Ionicons name="checkmark" size={22} color={colors.accentGreenPressed} />
                </View>
              )}
            </View>

            {subscriptionError && <Text style={styles.error}>{subscriptionError}</Text>}

            <View>
              <View style={styles.progressRow}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[styles.progressBar, i <= step && styles.progressBarFilled]} />
                ))}
              </View>
              <View style={styles.progressLabelsRow}>
                <View style={styles.progressLabelWrap}>
                  <Text style={[styles.progressLabel, step === 0 && styles.progressLabelActive]}>{t.trip.steps.coming}</Text>
                </View>
                <View style={styles.progressLabelWrap}>
                  <Text style={[styles.progressLabel, step === 1 && styles.progressLabelActive]}>{t.trip.steps.pickup}</Text>
                </View>
                <View style={styles.progressLabelWrap}>
                  <Text style={[styles.progressLabel, step === 2 && styles.progressLabelActive]}>{t.trip.steps.dropoff}</Text>
                </View>
              </View>
            </View>

            <View {...driverCardTarget} style={styles.driverStrip}>
              <View style={styles.driverStripRow}>
                <Avatar name={driver.name} source={driver.avatarUrl ? { uri: driver.avatarUrl } : undefined} size="md" />
                <View style={styles.driverInfoCol}>
                  <View style={styles.driverNameRow}>
                    <Text numberOfLines={1} style={styles.driverName}>
                      {driver.name || t.trip.noDriverMatchedTitle}
                    </Text>
                    {transferBannerVisible && (
                      <View style={styles.newTag}>
                        <Text style={styles.newTagText}>{t.trip.driver.new}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.driverMetaRow}>
                    {driver.rating !== null && driver.ratingCount >= 5 && (
                      <View style={styles.driverMetaItem}>
                        <Ionicons name="star" size={12} color={colors.accentGreen} />
                        <Text style={styles.driverMetaText}>{driver.rating.toFixed(1)}</Text>
                      </View>
                    )}
                    {driver.psoVerified && (
                      <View style={styles.driverMetaItem}>
                        <Ionicons name="shield-checkmark" size={12} color={colors.accentGreen} />
                        <Text style={styles.driverMetaText}>{t.trip.driver.psoVerified}</Text>
                      </View>
                    )}
                  </View>
                </View>
                {!!driver.plateNumber && (
                  <View style={styles.plateTag}>
                    <Text style={styles.plateLabel}>{t.chat.plate}</Text>
                    <Text numberOfLines={1} style={styles.plateValue}>
                      {driver.plateNumber}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.contactRow}>
                {features.rideCall && (
                  <Pressable style={styles.contactButton} accessibilityRole="button" onPress={handleCall}>
                    <Ionicons name="call-outline" size={17} color={colors.accentBlue} />
                    <Text style={styles.contactLabel}>{t.trip.driver.call}</Text>
                  </Pressable>
                )}
                <Pressable
                  style={[styles.contactButton, unreadMessageCount > 0 && styles.contactButtonFilled]}
                  accessibilityRole="button"
                  accessibilityLabel={t.trip.messageDriver}
                  onPress={() => (tutorialDemo.active ? undefined : router.push('/booking/chat'))}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={17} color={unreadMessageCount > 0 ? colors.white : colors.accentBlue} />
                  <Text numberOfLines={1} style={[styles.contactLabel, unreadMessageCount > 0 && styles.contactLabelFilled]}>
                    {t.trip.messageButton}
                  </Text>
                  {unreadMessageCount > 0 && (
                    <View style={styles.contactCountPill}>
                      <Text style={styles.contactCountPillText}>{unreadMessageCount > 99 ? '99+' : unreadMessageCount}</Text>
                    </View>
                  )}
                </Pressable>
              </View>
            </View>

            <View style={styles.routeRail}>
              <View style={styles.routeRow}>
                <View style={styles.railCol}>
                  <View style={styles.railRingPickup} />
                  <View style={styles.railLine} />
                </View>
                <View style={styles.routeTextCol}>
                  <Text style={styles.routeLabel}>{t.trip.steps.pickup}</Text>
                  <Text numberOfLines={2} style={styles.routeAddress}>
                    {pickup?.address ?? '—'}
                  </Text>
                </View>
              </View>
              <View style={styles.routeRow}>
                <View style={styles.railCol}>
                  <View style={styles.railSquareDropoff} />
                </View>
                <View style={styles.routeTextCol}>
                  <Text style={styles.routeLabel}>{t.trip.steps.dropoff}</Text>
                  <Text numberOfLines={2} style={styles.routeAddress}>
                    {dropoff?.address ?? '—'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.fareRow}>
              <Ionicons name={paymentMethod === 'gcash' ? 'phone-portrait-outline' : 'cash-outline'} size={20} color={colors.inkSoft} />
              <Text style={styles.farePayLine}>{payLine}</Text>
              <Text style={styles.fareAmount}>{fare !== null ? formatCurrency(fare) : '—'}</Text>
            </View>

            {stage !== 3 && !tutorialDemo.active && (
              <>
                <Pressable style={styles.cancelButton} accessibilityRole="button" onPress={() => setCancelSheetVisible(true)}>
                  <Text style={styles.cancelButtonText}>{t.trip.cancelRide}</Text>
                </Pressable>
                {cancelError && <Text style={styles.error}>{cancelError}</Text>}
              </>
            )}
          </ScrollView>
        </View>
        </ReAnimated.View>
      </Animated.View>

      <CancelReasonSheet
        visible={cancelSheetVisible}
        title={t.trip.cancelSheet.title}
        body={cancelBody}
        options={PASSENGER_CANCEL_REASON_CODES.map((code) => ({ code, label: t.trip.cancelReasons[code] }))}
        keepLabel={t.trip.cancelSheet.keep}
        cancelLabel={t.trip.cancelSheet.button}
        confirmLoading={cancelling}
        onKeep={() => setCancelSheetVisible(false)}
        onConfirm={handleCancelRide}
        bottomInset={insets.bottom}
      />
    </View>
  );
}
