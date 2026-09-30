import { useCallback, useMemo, useRef, useState } from 'react';
import { DRIVER_CANCEL_REASON_CODES, TRANSFER_REASON_CODES, TRICYCLE_SPEED_KMH, features, sortByNextStop } from '@trisakay/shared';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { Linking, Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  Button,
  Card,
  ChatPreviewBanner,
  ConfirmModal,
  HoldToConfirmButton,
  MapOverlaySheet,
  OsmMap,
  ReasonPickerModal,
  TransferCandidatesModal,
  colors,
  useNavigationRoute,
  useTutorialTarget,
} from '@trisakay/ui';
import { inviteTransfer, listMessages, listTransferCandidates, type TransferCandidate } from '@trisakay/services';
import { useAcceptRideRequest } from '../../src/hooks/useAcceptRideRequest';
import { useChatPreviewBanner } from '../../src/hooks/useChatPreviewBanner';
import { useRequestCountdown } from '../../src/hooks/useRequestCountdown';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useActiveTripTutorialDemo } from '../../src/hooks/useTutorialDemoState';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useDriverStore } from '../../src/store/useDriverStore';
import { useRequestsStore } from '../../src/store/useRequestsStore';
import { useTripStore } from '../../src/store/useTripStore';
import { formatCurrency } from '../../src/utils/currency';
import { fetchNavigationRoute } from '../../src/utils/route';
import { interpolate } from '../../src/utils/interpolate';
import type { PendingRequest } from '../../src/types/request';
import type { ActivePassenger } from '../../src/types/trip';
import { styles } from '../../src/styles/trip/active.styles';

function firstNameOf(name: string | null, fallback: string): string {
  if (!name) return fallback;
  return name.trim().split(/\s+/)[0] ?? fallback;
}

export default function ActiveTripScreen() {
  const router = useRouter();
  const t = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const tutorialDemo = useActiveTripTutorialDemo();
  const passengerCardTarget = useTutorialTarget('passenger-card');
  const sosTarget = useTutorialTarget('sos');
  const tripReal = useTripStore((state) => state.current);
  const trip = tutorialDemo.active ? tutorialDemo.data : tripReal;
  const tripError = useTripStore((state) => state.error);
  const driverLat = useDriverStore((state) => state.currentLat);
  const driverLng = useDriverStore((state) => state.currentLng);
  const driverHeading = useDriverStore((state) => state.currentHeading);
  const confirmCash = useTripStore((state) => state.confirmCash);
  const startPassenger = useTripStore((state) => state.startPassenger);
  const markArrived = useTripStore((state) => state.markArrived);
  const completePassenger = useTripStore((state) => state.completePassenger);
  const cancelPassenger = useTripStore((state) => state.cancelPassenger);
  const releasePassenger = useTripStore((state) => state.releasePassenger);
  const completeHandoffAction = useTripStore((state) => state.completeHandoff);
  const hydrateTrip = useTripStore((state) => state.hydrate);
  const endTrip = useTripStore((state) => state.endTrip);
  const recordCompletedTrip = useDriverStore((state) => state.recordCompletedTrip);

  // FR-2.5c mid-trip pickup — the request board stays live for as long as
  // the trip is active, not just pre-trip like Dashboard's. Subscription
  // lifetime is owned session-wide by useRequestsSync (app/_layout.tsx), tied
  // to isAvailable (which is also what the backend's matching function gates
  // on), so this screen just reads pending/error/decline like Dashboard does.
  const pending = useRequestsStore((state) => state.pending);
  const requestError = useRequestsStore((state) => state.error);
  const decline = useRequestsStore((state) => state.decline);
  const { acceptRideRequest, acceptingId } = useAcceptRideRequest();

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [confirmingCashId, setConfirmingCashId] = useState<string | null>(null);
  // A Set, not a single id — completing one passenger must not block
  // completing a DIFFERENT passenger on the same trip at the same time
  // (FR-2.5c passengers are independently completable). The single-id
  // version silently swallowed taps on any other passenger's Complete
  // button while one was already in flight, with no visual feedback.
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [startingIds, setStartingIds] = useState<Set<string>>(new Set());
  const [arrivingIds, setArrivingIds] = useState<Set<string>>(new Set());
  const [confirmingEndTrip, setConfirmingEndTrip] = useState(false);
  const [endingTrip, setEndingTrip] = useState(false);
  // D8 (UAT audit): a single tap used to complete a leg immediately — this
  // mirrors the Cancel/End Trip confirm pattern already on this screen.
  const [completingPassenger, setCompletingPassenger] = useState<ActivePassenger | null>(null);
  // §6.7 — "All passengers dropped off" needs a running total for this trip;
  // once `trip.passengers` empties there's nothing left to sum from.
  const [droppedOffThisTrip, setDroppedOffThisTrip] = useState<{ count: number; total: number }>({ count: 0, total: 0 });

  // D1 (UAT audit): outgoing transfer flow — reason picker, then candidates.
  const [transferringPassenger, setTransferringPassenger] = useState<ActivePassenger | null>(null);
  const [transferReasonPickerVisible, setTransferReasonPickerVisible] = useState(false);
  const [transferCandidatesVisible, setTransferCandidatesVisible] = useState(false);
  const [transferReason, setTransferReason] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<TransferCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [releasingPassenger, setReleasingPassenger] = useState<ActivePassenger | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [completingHandoffIds, setCompletingHandoffIds] = useState<Set<string>>(new Set());

  // Redesign v2 §6.6 — the ⋯ button opens this sheet instead of exposing
  // Transfer/Release/Cancel directly on the card.
  const [optionsPassenger, setOptionsPassenger] = useState<ActivePassenger | null>(null);

  // The sheet reports its live height here so the map's recenter button rides it up and down (drag/collapse).
  const sheetHeight = useSharedValue(260);
  const { height: windowHeight } = useWindowDimensions();
  // Bounds the sheet so it can never grow past the viewport — with it
  // unbounded, 3+ simultaneous passengers pushed the top card(s) above y=0
  // with no way to scroll to them (confirmed live). The passenger list below
  // scrolls internally within this bound; SOS and End Trip stay outside the
  // ScrollView so they're always reachable without scrolling.
  // Capped at 62% of the screen (not "viewport minus a fixed offset") so the
  // map stays visible behind the sheet even for a single passenger card —
  // the ScrollView above still handles any overflow from extra passengers.
  const sheetMaxHeight = Math.max(320, Math.min(windowHeight - insets.top - 96, windowHeight * 0.62));

  // D2 (UAT panel, Adrales): passengers ordered by their next stop, with the
  // transfer/overdue priorities — see packages/shared/src/utils/nextStop.ts.
  // The last shown order feeds the 150 m no-jump rule. Recomputed on each
  // GPS update, which is also when the overdue check re-evaluates.
  const previousOrderRef = useRef<string[]>([]);
  const passengers = trip?.passengers;
  const sortedStops = useMemo(() => {
    const driverPos = driverLat !== null && driverLng !== null ? { lat: driverLat, lng: driverLng } : null;
    const sorted = sortByNextStop(passengers ?? [], driverPos, previousOrderRef.current);
    previousOrderRef.current = sorted.map((s) => s.passenger.id);
    return sorted;
  }, [passengers, driverLat, driverLng]);

  // In-app navigation: a road route from the live position to the top stop that
  // follows the driver along it (trimmed as they drive, re-fetched if they leave it).
  const navTop = sortedStops[0];
  const navOrigin = driverLat !== null && driverLng !== null ? { latitude: driverLat, longitude: driverLng } : null;
  const navDestination =
    navTop && navTop.stopLat !== null && navTop.stopLng !== null ? { latitude: navTop.stopLat, longitude: navTop.stopLng } : null;
  const navigation = useNavigationRoute({ origin: navOrigin, destination: navDestination, fetchRoute: fetchNavigationRoute });

  const incoming = pending[0];
  const incomingSeconds = useRequestCountdown(incoming?.expiresAt ?? null);

  // C1 — a per-passenger count for the chat badge, not a live subscription
  // per thread: the full live experience only opens once the driver
  // actually taps into a passenger's thread (trip/chat/[rideRequestId],
  // which owns its own subscription via useChatStore). Refetches whenever
  // the passenger roster changes AND on every return to this screen's
  // focus (README §4.2) — the latter is what clears a badge after the
  // driver reads a thread and taps back.
  const [unreadByRideRequestId, setUnreadByRideRequestId] = useState<Record<string, number>>({});
  const passengerIds = (trip?.passengers ?? []).map((p) => p.id).join(',');
  useFocusEffect(
    useCallback(() => {
      if (!user || !passengerIds) return;
      let cancelled = false;
      Promise.all(
        passengerIds.split(',').map(async (id) => {
          const { data } = await listMessages(id);
          return [id, data.filter((m) => m.senderId !== user.id && m.readAt === null).length] as const;
        })
      ).then((entries) => {
        if (cancelled) return;
        setUnreadByRideRequestId(Object.fromEntries(entries));
      });
      return () => {
        cancelled = true;
      };
    }, [passengerIds, user])
  );

  const { preview, dismiss: dismissPreview } = useChatPreviewBanner(trip?.passengers.map((p) => p.id) ?? [], user?.id);

  if (!trip) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  const hasPassengers = trip.passengers.length > 0;
  const top = sortedStops[0];

  // P1-14 (2026-09-15 launch audit) + D2: the map's routing target and the
  // Navigate button follow the top ("Next stop") card — its pickup while
  // waiting, its destination once on board.
  const routingPassenger = top?.passenger;
  const targetLat = top?.stopLat ?? null;
  const targetLng = top?.stopLng ?? null;
  const hasTarget = targetLat !== null && targetLng !== null;
  const hasDriverPosition = driverLat !== null && driverLng !== null;

  const statusLabel = !hasPassengers
    ? t.driver.tripActive.tripOpenEmpty
    : routingPassenger?.status === 'ongoing'
      ? t.driver.tripActive.toDropoff
      : routingPassenger?.arrivedAt
        ? t.driver.tripActive.waitingAtPickup
        : t.driver.tripActive.headingToPickup;

  function handleNavigate() {
    if (!hasTarget) return;
    const label = encodeURIComponent(
      routingPassenger?.status === 'assigned' ? t.driver.requestCard.pickupLabel : t.driver.requestCard.dropoffLabel,
    );
    // Hands off to the OS maps app rather than building an in-app router —
    // consistent with FR-2's "lightweight trigonometry, not a routing
    // engine call" scope for this prototype.
    const url = Platform.select({
      ios: `maps://?daddr=${targetLat},${targetLng}&q=${label}`,
      android: `geo:${targetLat},${targetLng}?q=${targetLat},${targetLng}(${label})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}`,
    });
    Linking.openURL(url).catch(() => {
      // No maps app registered for the scheme — fall back to the web URL.
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}`).catch(() => {});
    });
  }

  async function handleConfirmCash(passengerId: string) {
    if (!user) return;
    setConfirmingCashId(passengerId);
    await confirmCash(passengerId, user.id);
    setConfirmingCashId(null);
  }

  async function handleStart(passengerId: string) {
    if (startingIds.has(passengerId)) return;
    setStartingIds((prev) => new Set(prev).add(passengerId));
    await startPassenger(passengerId);
    setStartingIds((prev) => {
      const next = new Set(prev);
      next.delete(passengerId);
      return next;
    });
  }

  async function handleMarkArrived(passengerId: string) {
    if (arrivingIds.has(passengerId)) return;
    setArrivingIds((prev) => new Set(prev).add(passengerId));
    await markArrived(passengerId);
    setArrivingIds((prev) => {
      const next = new Set(prev);
      next.delete(passengerId);
      return next;
    });
  }

  async function handleConfirmComplete() {
    const passenger = completingPassenger;
    if (!passenger || completingIds.has(passenger.id)) return;
    setCompletingIds((prev) => new Set(prev).add(passenger.id));
    const closed = await completePassenger(passenger.id);
    setCompletingIds((prev) => {
      const next = new Set(prev);
      next.delete(passenger.id);
      return next;
    });
    setCompletingPassenger(null);
    // Trip history/earnings both read fresh from the backend on their own
    // tabs — recordCompletedTrip is only Dashboard's local today-stat tally.
    if (closed) {
      recordCompletedTrip(closed.fare ?? 0);
      setDroppedOffThisTrip((prev) => ({ count: prev.count + 1, total: prev.total + (closed.fare ?? 0) }));
    }
  }

  async function handleConfirmCancel(reasonCode: string) {
    if (!cancellingId || confirmingCancel) return;
    setConfirmingCancel(true);
    await cancelPassenger(cancellingId, reasonCode);
    setConfirmingCancel(false);
    setCancellingId(null);
  }

  // D1 (UAT audit): after invites go out, this driver's own passenger list
  // has no realtime signal for "the invite was accepted" (unlike the
  // invited driver, who has subscribeToTransferInvites) — a short poll is a
  // much smaller lift than a dedicated subscription for a one-shot, 30s-ish
  // window, and hydrate() is already the authoritative rehydrate path used
  // on app boot.
  function pollTripAfterTransfer(rideRequestId: string) {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      await hydrateTrip();
      const stillHere = useTripStore.getState().current?.passengers.some((p) => p.id === rideRequestId);
      if (!stillHere || attempts >= 10) clearInterval(interval);
    }, 4000);
  }

  function handleOpenTransfer(passenger: ActivePassenger) {
    setOptionsPassenger(null);
    setTransferringPassenger(passenger);
    setTransferReasonPickerVisible(true);
  }

  async function handleTransferReasonConfirm(reasonCode: string) {
    setTransferReasonPickerVisible(false);
    setTransferReason(reasonCode);
    setTransferCandidatesVisible(true);
    setCandidatesLoading(true);
    const passenger = transferringPassenger;
    if (passenger) {
      const { data } = await listTransferCandidates(passenger.id);
      setCandidates(data);
    }
    setCandidatesLoading(false);
  }

  async function handleSendInvites(driverIds: string[]) {
    const passenger = transferringPassenger;
    if (!passenger || !transferReason || sendingInvites) return;
    setSendingInvites(true);
    const reasonLabel = t.driver.transfer.reasons[transferReason as keyof typeof t.driver.transfer.reasons] ?? transferReason;
    const { error } = await inviteTransfer(passenger.id, reasonLabel, driverIds);
    setSendingInvites(false);
    setTransferCandidatesVisible(false);
    setTransferringPassenger(null);
    setTransferReason(null);
    if (error) {
      useTripStore.setState({ error });
      return;
    }
    pollTripAfterTransfer(passenger.id);
  }

  function handleOpenRelease(passenger: ActivePassenger) {
    setOptionsPassenger(null);
    setReleasingPassenger(passenger);
  }

  async function handleConfirmRelease(reasonCode: string) {
    const passenger = releasingPassenger;
    if (!passenger || releasing) return;
    setReleasing(true);
    const reasonLabel = t.driver.transfer.reasons[reasonCode as keyof typeof t.driver.transfer.reasons] ?? reasonCode;
    await releasePassenger(passenger.id, reasonLabel);
    setReleasing(false);
    setReleasingPassenger(null);
  }

  function handleOpenCancel(passenger: ActivePassenger) {
    setOptionsPassenger(null);
    setCancellingId(passenger.id);
  }

  async function handleCompleteHandoff(rideRequestId: string) {
    if (completingHandoffIds.has(rideRequestId)) return;
    setCompletingHandoffIds((prev) => new Set(prev).add(rideRequestId));
    await completeHandoffAction(rideRequestId);
    setCompletingHandoffIds((prev) => {
      const next = new Set(prev);
      next.delete(rideRequestId);
      return next;
    });
  }

  async function handleConfirmEndTrip() {
    if (endingTrip) return;
    setEndingTrip(true);
    const ok = await endTrip();
    setEndingTrip(false);
    setConfirmingEndTrip(false);
    if (ok) router.replace('/(tabs)/dashboard');
  }

  const optionsBusy = !!optionsPassenger && (completingIds.has(optionsPassenger.id) || startingIds.has(optionsPassenger.id));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.mapFill}>
        <OsmMap
          variant="route"
          caption={hasTarget ? undefined : t.trip.mapCaption}
          height="100%"
          latitude={hasDriverPosition ? driverLat! : hasTarget ? targetLat! : undefined}
          longitude={hasDriverPosition ? driverLng! : hasTarget ? targetLng! : undefined}
          marker={hasTarget ? { latitude: targetLat!, longitude: targetLng! } : null}
          markerColor={routingPassenger?.status === 'ongoing' ? colors.accentBlue : colors.accentGreen}
          route={navigation.route}
          followPosition={hasDriverPosition ? { latitude: driverLat!, longitude: driverLng!, heading: driverHeading } : null}
          interactive
          edgeToEdge
          bottomInset={260}
          bottomInsetValue={sheetHeight}
        />
      </View>

      <View style={styles.statusBadgeWrap}>
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusLabel}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.sosWrap} {...sosTarget}>
        <HoldToConfirmButton
          variant="fab"
          label={t.trip.sosShortLabel}
          icon={<Ionicons name="warning" size={18} color={colors.white} />}
          onConfirm={() => (tutorialDemo.active ? undefined : router.push('/trip/emergency'))}
        />
        <View style={styles.sosChip}>
          <Text style={styles.sosChipText}>{t.trip.sosHold}</Text>
        </View>
      </View>

      {preview &&
        (() => {
          const previewPassenger = trip?.passengers.find((p) => p.id === preview.rideRequestId);
          if (!previewPassenger) return null;
          const name = firstNameOf(previewPassenger.passengerName, t.driver.tripActive.passengerFallback);
          const stage = previewPassenger.status === 'ongoing' ? t.driver.chat.headerOnBoardPlain : t.driver.chat.headerPickupPlain;
          const isPhoto = preview.kind === 'image';
          const previewText = isPhoto
            ? t.driver.chat.photo
            : preview.kind === 'quick_reply'
              ? ((t.driver.chat.quickReplies as Record<string, string>)[preview.body ?? ''] ?? preview.body ?? '')
              : (preview.body ?? '');
          return (
            <ChatPreviewBanner
              title={`${name} · ${stage}`}
              avatarUrl={previewPassenger.passengerAvatarUrl}
              previewText={previewText}
              isPhoto={isPhoto}
              replyLabel={t.driver.tripActive.messagePreviewReply}
              topOffset={76}
              onPress={() => {
                dismissPreview();
                router.push(`/trip/chat/${preview.rideRequestId}`);
              }}
            />
          );
        })()}

      <MapOverlaySheet bottomInset={insets.bottom} maxHeight={sheetMaxHeight} heightValue={sheetHeight} style={styles.content}>
        <ScrollView style={styles.passengerScroll} contentContainerStyle={styles.passengerScrollContent} showsVerticalScrollIndicator>
          {incoming && (
            <RequestBanner
              request={incoming}
              seconds={incomingSeconds}
              accepting={acceptingId === incoming.id}
              onAccept={() => (tutorialDemo.active ? undefined : acceptRideRequest(incoming.id))}
              onDecline={() => (tutorialDemo.active ? undefined : user && decline(incoming.id, user.id))}
              t={t}
            />
          )}

          {!hasPassengers && (
            <View style={styles.doneWrap}>
              <View style={styles.doneCircle}>
                <Ionicons name="checkmark" size={28} color={colors.accentGreenPressed} />
              </View>
              {droppedOffThisTrip.count > 0 ? (
                <>
                  <Text style={styles.doneTitle}>{t.driver.tripActive.allDroppedTitle}</Text>
                  <Text style={styles.doneBody}>
                    {interpolate(t.driver.tripActive.allDroppedBody, { amount: droppedOffThisTrip.total.toFixed(2), n: droppedOffThisTrip.count })}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.doneTitle}>{t.driver.tripActive.onlineNoPassengers}</Text>
                  <Text style={styles.doneBody}>{t.driver.tripActive.noPassengersNote}</Text>
                </>
              )}
            </View>
          )}

          {hasPassengers && (
            <View style={styles.aboardRow}>
              <Text style={styles.aboardLabel}>
                {t.driver.tripActive.aboard} · {trip.passengers.length}{' '}
                {trip.passengers.length > 1 ? t.driver.tripActive.passengerPlural : t.driver.tripActive.passengerSingular}
              </Text>
            </View>
          )}

          {top && (
            <NextStopCard
              key={top.passenger.id}
              stop={top}
              index={0}
              total={sortedStops.length}
              t={t}
              tutorialActive={tutorialDemo.active}
              hasTarget={hasTarget}
              onNavigate={handleNavigate}
              isCompleting={completingIds.has(top.passenger.id)}
              isStarting={startingIds.has(top.passenger.id)}
              isArriving={arrivingIds.has(top.passenger.id)}
              confirmingCashId={confirmingCashId}
              completingHandoffIds={completingHandoffIds}
              onMarkArrived={handleMarkArrived}
              onStart={handleStart}
              onConfirmCash={handleConfirmCash}
              onOpenComplete={setCompletingPassenger}
              onCompleteHandoff={handleCompleteHandoff}
              onOpenOptions={setOptionsPassenger}
              onOpenChat={(id) => router.push(`/trip/chat/${id}`)}
              unreadCount={unreadByRideRequestId[top.passenger.id] ?? 0}
              cardRef={passengerCardTarget}
            />
          )}

          {sortedStops.length > 1 && (
            <View style={styles.thenSection}>
              <Text style={styles.thenEyebrow}>{t.driver.tripActive.then}</Text>
              {sortedStops.slice(1).map(({ passenger, distanceKm }, i) => {
                const isPickup = passenger.status === 'assigned';
                const name = passenger.passengerName || t.driver.tripActive.passengerFallback;
                return (
                  <Pressable
                    key={passenger.id}
                    style={styles.thenRow}
                    accessibilityRole="button"
                    onPress={() => setOptionsPassenger(passenger)}
                  >
                    <View style={styles.thenNumber}>
                      <Text style={styles.thenNumberText}>{i + 2}</Text>
                    </View>
                    <View style={styles.thenTextCol}>
                      <Text style={styles.thenTitle} numberOfLines={1}>
                        {interpolate(isPickup ? t.driver.tripActive.pickUpName : t.driver.tripActive.dropOffName, { name })}
                      </Text>
                      <Text style={styles.thenMeta} numberOfLines={1}>
                        {[
                          distanceKm !== null ? `${distanceKm.toFixed(1)} km` : null,
                          `${passenger.seats} ${passenger.seats > 1 ? t.driver.tripActive.seatsPlural : t.driver.tripActive.seatsSingular}`,
                          passenger.paymentMethod === 'gcash' ? t.driver.requestCard.paymentMethodGcash : t.driver.requestCard.paymentMethodCash,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    <Pressable style={styles.thenChatButton} accessibilityRole="button" onPress={() => router.push(`/trip/chat/${passenger.id}`)}>
                      <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.accentBlue} />
                      {(unreadByRideRequestId[passenger.id] ?? 0) > 0 && (
                        <View style={styles.thenUnreadBadge}>
                          <Text style={styles.thenUnreadBadgeText}>{Math.min(unreadByRideRequestId[passenger.id], 99)}</Text>
                        </View>
                      )}
                    </Pressable>
                    <Pressable style={styles.thenOptionsButton} accessibilityRole="button" onPress={() => setOptionsPassenger(passenger)}>
                      <Ionicons name="ellipsis-horizontal" size={16} color={colors.inkSoft} />
                    </Pressable>
                  </Pressable>
                );
              })}
            </View>
          )}

        {(tripError || requestError) && <Text style={styles.error}>{tripError ?? requestError}</Text>}

        {hasPassengers && !tutorialDemo.active && (
          <View style={styles.doneInfoNote}>
            <Ionicons name="information-circle-outline" size={16} color={colors.inkSoft} />
            <Text style={styles.doneInfoNoteText}>{t.driver.tripActive.stillOnlineNote}</Text>
          </View>
        )}

        {!hasPassengers && (
          <>
            <View style={styles.doneInfoNote}>
              <Ionicons name="information-circle-outline" size={16} color={colors.inkSoft} />
              <Text style={styles.doneInfoNoteText}>{t.driver.tripActive.stillOnlineNote}</Text>
            </View>
            <Button
              label={t.driver.tripActive.endTrip}
              variant="outline"
              tone="neutral"
              fullWidth
              disabled={tutorialDemo.active}
              onPress={() => (tutorialDemo.active ? undefined : setConfirmingEndTrip(true))}
            />
          </>
        )}
        </ScrollView>
      </MapOverlaySheet>

      {/* §6.6 — the ⋯ button's options sheet, shared by the next-stop card and the "then" list. */}
      <Modal visible={!!optionsPassenger} transparent animationType="slide" onRequestClose={() => setOptionsPassenger(null)}>
        <Pressable style={styles.optionsBackdrop} onPress={() => setOptionsPassenger(null)}>
          <Pressable style={styles.optionsSheet} onPress={() => {}}>
            <View style={styles.optionsHandle} />
            {optionsPassenger && (
              <>
                <View style={styles.optionsHeader}>
                  <Avatar
                    name={optionsPassenger.passengerName ?? undefined}
                    source={optionsPassenger.passengerAvatarUrl ? { uri: optionsPassenger.passengerAvatarUrl } : undefined}
                    size="lg"
                  />
                  <View style={styles.optionsHeaderTextCol}>
                    <Text style={styles.optionsHeaderName} numberOfLines={1}>
                      {optionsPassenger.passengerName || t.driver.tripActive.passengerFallback}
                    </Text>
                    <Text style={styles.optionsHeaderMeta}>
                      {interpolate(t.driver.tripActive.optionsMeta, {
                        seats: optionsPassenger.seats,
                        fare: optionsPassenger.fare !== null ? optionsPassenger.fare.toFixed(2) : '—',
                        payment: optionsPassenger.paymentMethod === 'gcash' ? t.driver.requestCard.paymentMethodGcash : t.driver.requestCard.paymentMethodCash,
                      })}
                    </Text>
                  </View>
                </View>

                <Pressable
                  style={[styles.optionsRow, styles.optionsRowFirst, optionsBusy && styles.optionsRowDisabled]}
                  accessibilityRole="button"
                  disabled={optionsBusy}
                  onPress={() => handleOpenTransfer(optionsPassenger)}
                >
                  <View style={[styles.optionsTile, styles.optionsTileBlue]}>
                    <Ionicons name="swap-horizontal" size={20} color={colors.accentBlue} />
                  </View>
                  <View style={styles.optionsRowTextCol}>
                    <Text style={styles.optionsRowTitle}>{t.driver.tripActive.optionsTransferTitle}</Text>
                    <Text style={styles.optionsRowDesc}>{t.driver.tripActive.optionsTransferDesc}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.lineStrong} />
                </Pressable>

                <Pressable
                  style={[styles.optionsRow, optionsBusy && styles.optionsRowDisabled]}
                  accessibilityRole="button"
                  disabled={optionsBusy}
                  onPress={() => handleOpenRelease(optionsPassenger)}
                >
                  <View style={[styles.optionsTile, styles.optionsTileFill]}>
                    <Ionicons name="exit-outline" size={20} color={colors.ink} />
                  </View>
                  <View style={styles.optionsRowTextCol}>
                    <Text style={styles.optionsRowTitle}>{t.driver.tripActive.optionsReleaseTitle}</Text>
                    <Text style={styles.optionsRowDesc}>{t.driver.tripActive.optionsReleaseDesc}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.lineStrong} />
                </Pressable>

                <Pressable
                  style={[styles.optionsRow, optionsBusy && styles.optionsRowDisabled]}
                  accessibilityRole="button"
                  disabled={optionsBusy}
                  onPress={() => handleOpenCancel(optionsPassenger)}
                >
                  <View style={[styles.optionsTile, styles.optionsTileDanger]}>
                    <Ionicons name="close" size={20} color={colors.danger} />
                  </View>
                  <View style={styles.optionsRowTextCol}>
                    <Text style={[styles.optionsRowTitle, styles.optionsRowTitleDanger]}>{t.driver.tripActive.optionsCancelTitle}</Text>
                    <Text style={styles.optionsRowDesc}>{t.driver.tripActive.optionsCancelDesc}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.lineStrong} />
                </Pressable>

                <View style={styles.optionsCloseButton}>
                  <Button label={t.driver.tripActive.close} variant="outline" tone="neutral" fullWidth onPress={() => setOptionsPassenger(null)} />
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <ReasonPickerModal
        visible={!!cancellingId}
        title={t.driver.tripActive.cancelPassengerTitle}
        message={t.driver.tripActive.cancelPassengerMessage}
        options={DRIVER_CANCEL_REASON_CODES.map((code) => ({ code, label: t.driver.tripActive.cancelReasons[code] }))}
        cancelLabel={t.driver.tripActive.keep}
        confirmLabel={t.driver.tripActive.cancelRide}
        confirmLoading={confirmingCancel}
        onCancel={() => setCancellingId(null)}
        onConfirm={handleConfirmCancel}
      />

      <ConfirmModal
        visible={!!completingPassenger}
        title={interpolate(t.driver.tripActive.dropoffConfirmTitle, { name: firstNameOf(completingPassenger?.passengerName ?? null, t.driver.tripActive.passengerFallback) })}
        message={interpolate(t.driver.tripActive.dropoffConfirmBody, { fare: completingPassenger?.fare !== null && completingPassenger?.fare !== undefined ? completingPassenger.fare.toFixed(2) : '0.00' })}
        cancelLabel={t.common.cancel}
        confirmLabel={t.driver.tripActive.complete}
        confirmLoading={!!completingPassenger && completingIds.has(completingPassenger.id)}
        onCancel={() => setCompletingPassenger(null)}
        onConfirm={handleConfirmComplete}
      />

      <ConfirmModal
        visible={confirmingEndTrip}
        title={t.driver.tripActive.endTripTitle}
        message={t.driver.tripActive.endTripMessage}
        cancelLabel={t.driver.tripActive.stayOnline}
        confirmLabel={t.driver.tripActive.endTrip}
        confirmLoading={endingTrip}
        onCancel={() => setConfirmingEndTrip(false)}
        onConfirm={handleConfirmEndTrip}
      />

      <ReasonPickerModal
        visible={transferReasonPickerVisible}
        title={t.driver.transfer.reasonTitle}
        options={TRANSFER_REASON_CODES.map((code) => ({ code, label: t.driver.transfer.reasons[code] }))}
        cancelLabel={t.common.cancel}
        confirmLabel={t.driver.transfer.sendInvites}
        onCancel={() => {
          setTransferReasonPickerVisible(false);
          setTransferringPassenger(null);
        }}
        onConfirm={handleTransferReasonConfirm}
      />

      <TransferCandidatesModal
        visible={transferCandidatesVisible}
        title={t.driver.transfer.candidatesTitle}
        loading={candidatesLoading}
        candidates={candidates}
        emptyMessage={t.driver.transfer.candidatesEmpty}
        distanceLabel={(km) => t.driver.transfer.distanceLabel.replace('{km}', km.toFixed(1))}
        seatsLabel={(seats) => t.driver.transfer.seatsLabel.replace('{seats}', String(seats))}
        confirmLabel={t.driver.transfer.sendInvites}
        cancelLabel={t.common.cancel}
        confirmLoading={sendingInvites}
        onCancel={() => {
          setTransferCandidatesVisible(false);
          setTransferringPassenger(null);
          setTransferReason(null);
        }}
        onConfirm={handleSendInvites}
      />

      <ReasonPickerModal
        visible={!!releasingPassenger}
        title={t.driver.transfer.releaseTitle}
        message={t.driver.transfer.releaseMessage}
        options={TRANSFER_REASON_CODES.map((code) => ({ code, label: t.driver.transfer.reasons[code] }))}
        cancelLabel={t.common.cancel}
        confirmLabel={t.driver.transfer.releaseConfirm}
        confirmLoading={releasing}
        onCancel={() => setReleasingPassenger(null)}
        onConfirm={handleConfirmRelease}
      />
    </SafeAreaView>
  );
}

type Translations = ReturnType<typeof useTranslation>;

interface NextStopCardProps {
  stop: { passenger: ActivePassenger; distanceKm: number | null };
  index: number;
  total: number;
  t: Translations;
  tutorialActive: boolean;
  hasTarget: boolean;
  onNavigate: () => void;
  isCompleting: boolean;
  isStarting: boolean;
  isArriving: boolean;
  confirmingCashId: string | null;
  completingHandoffIds: Set<string>;
  onMarkArrived: (id: string) => void;
  onStart: (id: string) => void;
  onConfirmCash: (id: string) => void;
  onOpenComplete: (passenger: ActivePassenger) => void;
  onCompleteHandoff: (id: string) => void;
  onOpenOptions: (passenger: ActivePassenger) => void;
  onOpenChat: (rideRequestId: string) => void;
  unreadCount: number;
  cardRef: ReturnType<typeof useTutorialTarget>;
}

/** The top ("next stop") card — §6.3/6.4. One primary action follows the passenger's own stage. */
function NextStopCard({
  stop,
  index,
  total,
  t,
  tutorialActive,
  hasTarget,
  onNavigate,
  isCompleting,
  isStarting,
  isArriving,
  confirmingCashId,
  completingHandoffIds,
  onMarkArrived,
  onStart,
  onConfirmCash,
  onOpenComplete,
  onCompleteHandoff,
  onOpenOptions,
  onOpenChat,
  unreadCount,
  cardRef,
}: NextStopCardProps) {
  const { passenger, distanceKm } = stop;
  const isPickup = passenger.status === 'assigned';
  const isCash = passenger.paymentMethod === 'cash';
  const name = firstNameOf(passenger.passengerName, t.driver.tripActive.passengerFallback);
  const etaMin = distanceKm !== null ? Math.max(1, Math.round((distanceKm / TRICYCLE_SPEED_KMH) * 60)) : null;

  let eyebrow: string;
  if (total === 1) {
    eyebrow = isPickup ? t.driver.tripActive.nextStopPickup : t.driver.tripActive.nextStopDropoff;
  } else {
    eyebrow = interpolate(isPickup ? t.driver.tripActive.stopOfPickup : t.driver.tripActive.stopOfDropoff, { n: index + 1, total });
  }

  let metaLine: string;
  if (isPickup && passenger.arrivedAt) {
    const minsAgo = Math.max(0, Math.round((Date.now() - Date.parse(passenger.arrivedAt)) / 60000));
    metaLine = interpolate(t.driver.tripActive.arrivedAgo, { n: minsAgo });
  } else if (distanceKm !== null && etaMin !== null) {
    metaLine = interpolate(t.driver.tripActive.etaLine, { km: distanceKm.toFixed(1), min: etaMin });
  } else {
    metaLine = '';
  }

  const canComplete = tutorialActive ? true : passenger.status === 'ongoing' && (!isCash || passenger.cashConfirmed) && !isCompleting;
  const hint =
    passenger.handoffLat !== null
      ? t.driver.tripActive.handoffNotice
      : isPickup && !passenger.arrivedAt
        ? interpolate(t.driver.tripActive.hintArrive, { name })
        : isPickup && passenger.arrivedAt
          ? interpolate(t.driver.tripActive.hintStart, { name })
          : isCash && !passenger.cashConfirmed
            ? t.driver.tripActive.hintCashFirst
            : interpolate(t.driver.tripActive.hintComplete, { name });

  return (
    <View {...cardRef}>
      <Card variant="flat" style={styles.passengerCard}>
        <View style={styles.nextStopRow}>
          <View style={[styles.nextStopTile, isPickup ? styles.nextStopTilePickup : styles.nextStopTileDropoff]}>
            {isPickup ? <View style={styles.pickupRing} /> : <View style={styles.dropoffSquare} />}
          </View>
          <View style={styles.nextStopTextCol}>
            <Text style={styles.nextStopEyebrow}>{eyebrow}</Text>
            <Text style={styles.nextStopAddress}>{isPickup ? t.driver.requestCard.pickupLabel : t.driver.requestCard.dropoffLabel}</Text>
            {!!metaLine && <Text style={styles.nextStopMeta}>{metaLine}</Text>}
          </View>
          {hasTarget && (
            <Pressable style={styles.navigateCol} accessibilityRole="button" onPress={onNavigate}>
              <View style={styles.navigateTile}>
                <Ionicons name="navigate" size={20} color={colors.white} />
              </View>
              <Text style={styles.navigateLabel}>{t.driver.tripActive.navigate}</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.passengerStrip}>
          <View style={styles.passengerTopRow}>
            <Avatar
              name={passenger.passengerName ?? undefined}
              source={passenger.passengerAvatarUrl ? { uri: passenger.passengerAvatarUrl } : undefined}
              size="md"
            />
            <View style={styles.passengerInfo}>
              <View style={styles.passengerNameRow}>
                <Text style={styles.passengerName} numberOfLines={1}>
                  {passenger.passengerName || t.driver.tripActive.passengerFallback}
                </Text>
                {passenger.status === 'ongoing' && (
                  <View style={[styles.statusChip, styles.statusChipOngoing]}>
                    <Text style={[styles.statusChipText, styles.statusChipTextOngoing]}>{t.driver.tripActive.ongoingStatus}</Text>
                  </View>
                )}
                {isPickup && passenger.arrivedAt && (
                  <View style={[styles.statusChip, styles.statusChipArrived]}>
                    <Text style={[styles.statusChipText, styles.statusChipTextArrived]}>{t.driver.tripActive.arrivedStatus}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.passengerSub} numberOfLines={1}>
                {passenger.seats} {passenger.seats > 1 ? t.driver.tripActive.seatsPlural : t.driver.tripActive.seatsSingular} ·{' '}
                {passenger.fare !== null ? formatCurrency(passenger.fare) : '—'} ·{' '}
                {isCash ? (passenger.cashConfirmed ? t.driver.tripActive.cashConfirmedInline : t.driver.requestCard.paymentMethodCash) : t.driver.tripActive.gcashConfirmedInline}
              </Text>
            </View>
            <Pressable style={styles.optionsButton} accessibilityRole="button" onPress={() => onOpenOptions(passenger)}>
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.ink} />
            </Pressable>
          </View>

          {/* README §4.1/§4.3 — Call is opt-in and off by default (no masked/proxy
              number exists today); Message alone then takes the full row. */}
          <View style={styles.contactRow}>
            {features.rideCall && (
              <Pressable style={styles.contactButton} accessibilityRole="button" onPress={() => {}}>
                <Ionicons name="call-outline" size={17} color={colors.accentBlue} />
                <Text style={styles.contactLabel}>{t.driver.tripActive.callButton}</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.contactButton, unreadCount > 0 && styles.contactButtonFilled]}
              accessibilityRole="button"
              onPress={() => onOpenChat(passenger.id)}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={17} color={unreadCount > 0 ? colors.white : colors.accentBlue} />
              <Text style={[styles.contactLabel, unreadCount > 0 && styles.contactLabelFilled]}>
                {unreadCount > 0 ? interpolate(t.driver.tripActive.messageButtonNamed, { name }) : t.driver.tripActive.messageButton}
              </Text>
              {unreadCount > 0 && (
                <View style={styles.contactCountPill}>
                  <Text style={styles.contactCountPillText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {passenger.handoffLat !== null && (
          <Button
            label={t.driver.tripActive.completeHandoffButton}
            variant="outline"
            fullWidth
            loading={completingHandoffIds.has(passenger.id)}
            disabled={completingHandoffIds.has(passenger.id)}
            onPress={() => (tutorialActive ? undefined : onCompleteHandoff(passenger.id))}
          />
        )}

        {isCash &&
          passenger.status === 'ongoing' &&
          (passenger.cashConfirmed ? (
            <View style={styles.cashRowDone}>
              <Ionicons name="checkmark-circle" size={18} color={colors.accentGreenPressed} />
              <Text style={styles.cashRowDoneText}>{interpolate(t.driver.tripActive.cashReceived, { fare: passenger.fare !== null ? passenger.fare.toFixed(2) : '0.00' })}</Text>
            </View>
          ) : (
            <View style={styles.cashRowPending}>
              <Ionicons name="cash-outline" size={22} color={colors.inkSoft} />
              <View style={styles.cashRowTextCol}>
                <Text style={styles.cashRowTitle}>{interpolate(t.driver.tripActive.collectCash, { fare: passenger.fare !== null ? passenger.fare.toFixed(2) : '0.00' })}</Text>
                <Text style={styles.cashRowSub}>{t.driver.tripActive.collectCashSub}</Text>
              </View>
              <Pressable
                style={styles.cashReceivedButton}
                accessibilityRole="button"
                disabled={confirmingCashId === passenger.id}
                onPress={() => (tutorialActive ? undefined : onConfirmCash(passenger.id))}
              >
                <Ionicons name="checkmark" size={15} color={colors.white} />
                <Text style={styles.cashReceivedButtonText}>{t.driver.tripActive.received}</Text>
              </Pressable>
            </View>
          ))}

        {isPickup && !passenger.arrivedAt && (
          <Button
            label={t.driver.tripActive.arrived}
            fullWidth
            loading={isArriving}
            disabled={isArriving}
            onPress={() => (tutorialActive ? undefined : onMarkArrived(passenger.id))}
          />
        )}

        {isPickup && passenger.arrivedAt && (
          <Button label={t.driver.tripActive.startRide} fullWidth loading={isStarting} onPress={() => (tutorialActive ? undefined : onStart(passenger.id))} />
        )}

        {!isPickup && (
          <Button
            label={t.driver.tripActive.completeDropoff}
            fullWidth
            disabled={!canComplete}
            loading={isCompleting}
            onPress={() => (tutorialActive ? undefined : onOpenComplete(passenger))}
          />
        )}

        <Text style={styles.primaryHint}>{hint}</Text>
      </Card>
    </View>
  );
}

interface RequestBannerProps {
  request: PendingRequest;
  seconds: number | null;
  accepting: boolean;
  onAccept: () => void;
  onDecline: () => void;
  t: Translations;
}

/** §6.5 — the mid-trip compatible-request banner, a slim top-of-sheet strip rather than a full RequestCard. */
function RequestBanner({ request, seconds, accepting, onAccept, onDecline, t }: RequestBannerProps) {
  return (
    <View style={styles.requestBanner}>
      <Text style={styles.requestBannerEyebrow}>{interpolate(t.driver.tripActive.requestOnRoute, { n: seconds ?? 0 })}</Text>
      <Text style={styles.requestBannerFare} numberOfLines={1}>
        {request.fare !== null ? formatCurrency(request.fare) : '—'} · {request.pickupLabel ?? '—'} → {request.dropoffLabel ?? '—'}
      </Text>
      <View style={styles.requestBannerRow}>
        <Pressable style={styles.requestBannerDecline} accessibilityRole="button" accessibilityLabel={t.driver.requestCard.decline} onPress={onDecline}>
          <Ionicons name="close" size={18} color={colors.ink} />
        </Pressable>
        <Pressable style={styles.requestBannerAccept} accessibilityRole="button" disabled={accepting} onPress={onAccept}>
          <Text style={styles.requestBannerAcceptText}>{accepting ? '…' : t.driver.requestCard.accept}</Text>
        </Pressable>
      </View>
    </View>
  );
}
