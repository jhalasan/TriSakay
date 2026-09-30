import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  cancelRideRequest,
  getTripDriverInfo,
  listMessages,
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
import { fetchRouteEstimate, type RouteEstimate } from '../../src/utils/route';

async function fetchRouteForNavigation(origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }) {
  const { geometry, source } = await fetchRouteEstimate(origin, destination);
  return { geometry, source };
}
import { styles } from '../../src/styles/booking/trip.styles';

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
  const setDriver = useBookingStore((state) => state.setDriver);
  const reset = useBookingStore((state) => state.reset);
  const user = useAuthStore((state) => state.user);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [transferBannerVisible, setTransferBannerVisible] = useState(false);

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
    if (rideStatus !== 'assigned' || arrivedAt || !driver?.id) {
      setDriverLocation(null);
      return;
    }
    const unsubscribe = subscribeToDriverLocation(driver.id, setDriverLocation);
    return unsubscribe;
  }, [rideStatus, arrivedAt, driver?.id]);

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

  // Auto-close the cancel sheet if the ride moves to 'ongoing' while it's open (Part B §B5).
  useEffect(() => {
    if (rideStatus === 'ongoing') setCancelSheetVisible(false);
  }, [rideStatus]);

  const etaToPickupMinutes =
    driverLocation && pickup
      ? estimateEtaMinutes(haversineKm(driverLocation.lat, driverLocation.lng, pickup.latitude, pickup.longitude), ASSUMED_TRICYCLE_SPEED_KMH)
      : null;
  const etaToDropoffMinutes = tripRoute ? estimateEtaMinutes(tripRoute.distanceKm, ASSUMED_TRICYCLE_SPEED_KMH) : null;

  const stage: Stage = rideStatus === 'ongoing' ? 3 : arrivedAt ? 2 : 1;

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
    sub = tripRoute ? interpolate(t.trip.sub.riding, { dropoff: dropoff?.label ?? '', km: tripRoute.distanceKm.toFixed(1) }) : '';
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
          route={stage === 3 ? tripRoute?.geometry : stage === 1 ? approach.route : null}
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
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.sheetScrollContent} showsVerticalScrollIndicator={false}>
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
                  <Pressable style={styles.contactButton} accessibilityRole="button" onPress={() => {}}>
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
                  <Text style={[styles.contactLabel, unreadMessageCount > 0 && styles.contactLabelFilled]}>
                    {unreadMessageCount > 0 ? interpolate(t.trip.messageDriverNamed, { name }) : t.trip.messageDriver}
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
