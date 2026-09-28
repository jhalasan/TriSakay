import { useMemo, useRef, useState } from 'react';
import { DRIVER_CANCEL_REASON_CODES, TRANSFER_REASON_CODES, sortByNextStop } from '@trisakay/shared';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { Linking, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  Button,
  Card,
  ConfirmModal,
  EmptyState,
  HoldToConfirmButton,
  MapOverlaySheet,
  OsmMap,
  ReasonPickerModal,
  RequestCard,
  Toggle,
  TransferCandidatesModal,
  colors,
  useTutorialTarget,
} from '@trisakay/ui';
import { inviteTransfer, listTransferCandidates, type TransferCandidate } from '@trisakay/services';
import { useAcceptRideRequest } from '../../src/hooks/useAcceptRideRequest';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useActiveTripTutorialDemo } from '../../src/hooks/useTutorialDemoState';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useDriverStore } from '../../src/store/useDriverStore';
import { useRequestsStore } from '../../src/store/useRequestsStore';
import { useTripStore } from '../../src/store/useTripStore';
import { formatCurrency } from '../../src/utils/currency';
import type { ActivePassenger } from '../../src/types/trip';
import { styles } from '../../src/styles/trip/active.styles';

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

  if (!trip) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  const incoming = pending[0];
  const hasPassengers = trip.passengers.length > 0;

  // P1-14 (2026-09-15 launch audit) + D2: the map's routing target and the
  // Navigate button follow the top ("Next stop") card — its pickup while
  // waiting, its destination once on board.
  const routingPassenger = sortedStops[0]?.passenger;
  const targetLat = sortedStops[0]?.stopLat ?? null;
  const targetLng = sortedStops[0]?.stopLng ?? null;
  const hasTarget = targetLat !== null && targetLng !== null;
  const hasDriverPosition = driverLat !== null && driverLng !== null;

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
    if (closed) recordCompletedTrip(closed.fare ?? 0);
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

  async function handleConfirmRelease(reasonCode: string) {
    const passenger = releasingPassenger;
    if (!passenger || releasing) return;
    setReleasing(true);
    const reasonLabel = t.driver.transfer.reasons[reasonCode as keyof typeof t.driver.transfer.reasons] ?? reasonCode;
    await releasePassenger(passenger.id, reasonLabel);
    setReleasing(false);
    setReleasingPassenger(null);
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
          route={hasTarget && hasDriverPosition ? [{ latitude: driverLat!, longitude: driverLng! }, { latitude: targetLat!, longitude: targetLng! }] : null}
          interactive
          edgeToEdge
          bottomInset={260}
        />
      </View>
      <View style={styles.statusBadgeWrap}>
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusLabel}>
            {hasPassengers ? t.driver.tripActive.inProgress : t.driver.tripActive.onlineNoPassengers}
          </Text>
        </View>
      </View>

      {hasTarget && (
        <Pressable
          style={styles.navigateButton}
          accessibilityRole="button"
          accessibilityLabel={t.driver.tripActive.navigate}
          onPress={handleNavigate}
        >
          <Ionicons name="navigate" size={20} color={colors.ink} />
        </Pressable>
      )}

      <MapOverlaySheet bottomInset={insets.bottom} maxHeight={sheetMaxHeight} style={styles.content}>
        <ScrollView style={styles.passengerScroll} contentContainerStyle={styles.passengerScrollContent} showsVerticalScrollIndicator>
        {!hasPassengers && (
          <EmptyState title={t.driver.tripActive.onlineNoPassengers} message={t.driver.tripActive.noPassengersNote} />
        )}

        {hasPassengers && (
          <View style={styles.aboardRow}>
            <Text style={styles.aboardLabel}>
              {t.driver.tripActive.aboard} · {trip.passengers.length}{' '}
              {trip.passengers.length > 1 ? t.driver.tripActive.passengerPlural : t.driver.tripActive.passengerSingular}
            </Text>
          </View>
        )}

        {sortedStops.map(({ passenger, distanceKm }, index) => {
          const isCash = passenger.paymentMethod === 'cash';
          const isCompleting = completingIds.has(passenger.id);
          const isStarting = startingIds.has(passenger.id);
          const canComplete = tutorialDemo.active
            ? true
            : passenger.status === 'ongoing' && (!isCash || passenger.cashConfirmed) && !isCompleting;

          // Card doesn't forward refs, so the tutorial target (which needs a
          // real native-view ref for measureInWindow) wraps it in a plain
          // View instead of spreading onto Card directly.
          const passengerCard = (
            <Card key={passenger.id} variant="flat" style={styles.passengerCard}>
              <View style={styles.passengerRow}>
                <Avatar
                  name={passenger.passengerName ?? undefined}
                  source={passenger.passengerAvatarUrl ? { uri: passenger.passengerAvatarUrl } : undefined}
                  size="lg"
                />
                <View style={styles.passengerInfo}>
                  <Text style={styles.passengerName}>{passenger.passengerName || t.driver.tripActive.passengerFallback}</Text>
                  <Text style={styles.seatsLabel}>
                    {passenger.seats} {passenger.seats > 1 ? t.driver.tripActive.seatsPlural : t.driver.tripActive.seatsSingular} ·{' '}
                    {passenger.fare !== null ? formatCurrency(passenger.fare) : '—'}
                    {!isCash ? ` · ${t.driver.tripActive.gcashConfirmedInline}` : ''}
                  </Text>
                  {(index === 0 || distanceKm !== null) && (
                    <Text style={index === 0 ? styles.nextStopLabel : styles.seatsLabel}>
                      {[index === 0 ? t.driver.tripActive.nextStop : null, distanceKm !== null ? `${distanceKm.toFixed(1)} km` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  )}
                </View>
                {passenger.status === 'ongoing' && (
                  <View style={styles.ongoingChip}>
                    <Text style={styles.ongoingChipText}>{t.driver.tripActive.ongoingStatus}</Text>
                  </View>
                )}
                {passenger.status === 'assigned' && passenger.arrivedAt && (
                  <View style={styles.arrivedChip}>
                    <Text style={styles.arrivedChipText}>{t.driver.tripActive.arrivedStatus}</Text>
                  </View>
                )}
              </View>

              {passenger.handoffLat !== null && (
                <>
                  <Text style={styles.seatsLabel}>{t.driver.tripActive.handoffNotice}</Text>
                  <Button
                    label={t.driver.tripActive.completeHandoffButton}
                    variant="outline"
                    fullWidth
                    loading={completingHandoffIds.has(passenger.id)}
                    disabled={completingHandoffIds.has(passenger.id)}
                    onPress={() => (tutorialDemo.active ? undefined : handleCompleteHandoff(passenger.id))}
                  />
                </>
              )}

              {isCash && (
                <View style={styles.cashRow}>
                  <Text style={styles.cashLabel}>{t.driver.tripActive.confirmCashReceived}</Text>
                  <Toggle
                    value={passenger.cashConfirmed}
                    onValueChange={() => (tutorialDemo.active ? undefined : handleConfirmCash(passenger.id))}
                    disabled={passenger.cashConfirmed || confirmingCashId === passenger.id}
                  />
                </View>
              )}

              {passenger.status === 'assigned' && !passenger.arrivedAt && (
                <Button
                  label={t.driver.tripActive.arrived}
                  variant="outline"
                  fullWidth
                  loading={arrivingIds.has(passenger.id)}
                  disabled={arrivingIds.has(passenger.id)}
                  onPress={() => (tutorialDemo.active ? undefined : handleMarkArrived(passenger.id))}
                />
              )}

              <View style={styles.actions}>
                <View style={styles.actionButton}>
                  <Button
                    label={t.common.cancel}
                    variant="outline"
                    tone="danger"
                    fullWidth
                    disabled={isCompleting || isStarting}
                    onPress={() => (tutorialDemo.active ? undefined : setCancellingId(passenger.id))}
                  />
                </View>
                {passenger.status === 'assigned' ? (
                  <View style={styles.actionButton}>
                    <Button
                      label={t.driver.tripActive.start}
                      fullWidth
                      loading={isStarting}
                      onPress={() => (tutorialDemo.active ? undefined : handleStart(passenger.id))}
                    />
                  </View>
                ) : (
                  <View style={styles.actionButton}>
                    <Button
                      label={t.driver.tripActive.complete}
                      fullWidth
                      disabled={!canComplete}
                      loading={isCompleting}
                      onPress={() => (tutorialDemo.active ? undefined : setCompletingPassenger(passenger))}
                    />
                  </View>
                )}
              </View>

              <View style={styles.actions}>
                <View style={styles.actionButton}>
                  <Button
                    label={t.driver.tripActive.transferButton}
                    variant="outline"
                    fullWidth
                    disabled={isCompleting || isStarting}
                    onPress={() => (tutorialDemo.active ? undefined : handleOpenTransfer(passenger))}
                  />
                </View>
                <View style={styles.actionButton}>
                  <Button
                    label={t.driver.tripActive.releaseButton}
                    variant="outline"
                    tone="danger"
                    fullWidth
                    disabled={isCompleting || isStarting}
                    onPress={() => (tutorialDemo.active ? undefined : setReleasingPassenger(passenger))}
                  />
                </View>
              </View>
            </Card>
          );

          return index === 0 ? (
            <View key={passenger.id} {...passengerCardTarget}>
              {passengerCard}
            </View>
          ) : (
            passengerCard
          );
        })}

        {incoming && (
          <View>
            <Text style={styles.sectionLabel}>{t.driver.tripActive.compatibleRequest}</Text>
            <RequestCard
              request={incoming}
              accepting={acceptingId === incoming.id}
              onAccept={() => (tutorialDemo.active ? undefined : acceptRideRequest(incoming.id))}
              onDecline={() => (tutorialDemo.active ? undefined : user && decline(incoming.id, user.id))}
              copy={{
                decline: t.driver.requestCard.decline,
                accept: t.driver.requestCard.accept,
                newRideRequest: t.driver.requestCard.newRideRequest,
                seatsSingular: t.driver.requestCard.seatsSingular,
                seatsPlural: t.driver.requestCard.seatsPlural,
                pickupLabel: t.driver.requestCard.pickupLabel,
                dropoffLabel: t.driver.requestCard.dropoffLabel,
                pickupAwaySuffix: t.driver.requestCard.pickupAwaySuffix,
                paymentMethodCash: t.driver.requestCard.paymentMethodCash,
                paymentMethodGcash: t.driver.requestCard.paymentMethodGcash,
              }}
            />
          </View>
        )}
        </ScrollView>

        {(tripError || requestError) && <Text style={styles.error}>{tripError ?? requestError}</Text>}

        <View style={styles.sosBlock} {...sosTarget}>
          <HoldToConfirmButton
            label={t.trip.sosButton}
            icon={<Ionicons name="warning" size={19} color={colors.white} />}
            fullWidth
            onConfirm={() => (tutorialDemo.active ? undefined : router.push('/trip/emergency'))}
          />
          <Text style={styles.sosCaption}>{t.trip.sosCaption}</Text>
        </View>

        <Button
          label={t.driver.tripActive.endTrip}
          variant="outline"
          tone="neutral"
          fullWidth
          disabled={tutorialDemo.active || hasPassengers}
          onPress={() => (tutorialDemo.active ? undefined : setConfirmingEndTrip(true))}
        />
      </MapOverlaySheet>

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
        title={t.driver.tripActive.completePassengerTitle}
        message={t.driver.tripActive.completePassengerMessage}
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
