import { useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, Card, ConfirmModal, EmptyState, HoldToConfirmButton, MapOverlaySheet, OsmMap, RequestCard, Toggle } from '@trisakay/ui';
import { useAcceptRideRequest } from '../../src/hooks/useAcceptRideRequest';
import { useTranslation } from '../../src/hooks/useTranslation';
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
  const trip = useTripStore((state) => state.current);
  const tripError = useTripStore((state) => state.error);
  const confirmCash = useTripStore((state) => state.confirmCash);
  const startPassenger = useTripStore((state) => state.startPassenger);
  const completePassenger = useTripStore((state) => state.completePassenger);
  const cancelPassenger = useTripStore((state) => state.cancelPassenger);
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
  const [confirmingEndTrip, setConfirmingEndTrip] = useState(false);
  const [endingTrip, setEndingTrip] = useState(false);

  const { height: windowHeight } = useWindowDimensions();
  // Bounds the sheet so it can never grow past the viewport — with it
  // unbounded, 3+ simultaneous passengers pushed the top card(s) above y=0
  // with no way to scroll to them (confirmed live). The passenger list below
  // scrolls internally within this bound; SOS and End Trip stay outside the
  // ScrollView so they're always reachable without scrolling.
  const sheetMaxHeight = Math.max(320, windowHeight - insets.top - 96);

  if (!trip) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  const incoming = pending[0];
  const hasPassengers = trip.passengers.length > 0;

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

  async function handleComplete(passenger: ActivePassenger) {
    if (completingIds.has(passenger.id)) return;
    setCompletingIds((prev) => new Set(prev).add(passenger.id));
    const closed = await completePassenger(passenger.id);
    setCompletingIds((prev) => {
      const next = new Set(prev);
      next.delete(passenger.id);
      return next;
    });
    // Trip history/earnings both read fresh from the backend on their own
    // tabs — recordCompletedTrip is only Dashboard's local today-stat tally.
    if (closed) recordCompletedTrip(closed.fare ?? 0);
  }

  async function handleConfirmCancel() {
    if (!cancellingId || confirmingCancel) return;
    setConfirmingCancel(true);
    await cancelPassenger(cancellingId, 'Cancelled by driver');
    setConfirmingCancel(false);
    setCancellingId(null);
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
        <OsmMap variant="route" caption={t.trip.mapCaption} height="100%" interactive={false} edgeToEdge bottomInset={260} />
      </View>
      <View style={styles.statusBadgeWrap}>
        <Badge
          label={hasPassengers ? t.driver.tripActive.inProgress : t.driver.tripActive.onlineNoPassengers}
          tone={hasPassengers ? 'blue' : 'neutral'}
          dot
        />
      </View>

      <MapOverlaySheet bottomInset={insets.bottom} maxHeight={sheetMaxHeight} style={styles.content}>
        <ScrollView style={styles.passengerScroll} contentContainerStyle={styles.passengerScrollContent} showsVerticalScrollIndicator>
        {!hasPassengers && (
          <EmptyState title={t.driver.tripActive.onlineNoPassengers} message={t.driver.tripActive.noPassengersNote} />
        )}

        {trip.passengers.map((passenger) => {
          const isCash = passenger.paymentMethod === 'cash';
          const isCompleting = completingIds.has(passenger.id);
          const isStarting = startingIds.has(passenger.id);
          const canComplete = passenger.status === 'ongoing' && (!isCash || passenger.cashConfirmed) && !isCompleting;

          return (
            <Card key={passenger.id} style={styles.passengerCard}>
              <View style={styles.passengerRow}>
                <Avatar
                  name={passenger.passengerName ?? undefined}
                  source={passenger.passengerAvatarUrl ? { uri: passenger.passengerAvatarUrl } : undefined}
                  size="lg"
                />
                <View>
                  <Text style={styles.passengerName}>{passenger.passengerName || t.driver.tripActive.passengerFallback}</Text>
                  <Text style={styles.seatsLabel}>
                    {passenger.seats} {passenger.seats > 1 ? t.driver.tripActive.seatsPlural : t.driver.tripActive.seatsSingular} ·{' '}
                    {passenger.fare !== null ? formatCurrency(passenger.fare) : '—'}
                  </Text>
                </View>
              </View>

              {isCash ? (
                <View style={styles.cashRow}>
                  <Text style={styles.cashLabel}>{t.driver.tripActive.confirmCashReceived}</Text>
                  <Toggle
                    value={passenger.cashConfirmed}
                    onValueChange={() => handleConfirmCash(passenger.id)}
                    disabled={passenger.cashConfirmed || confirmingCashId === passenger.id}
                  />
                </View>
              ) : (
                <Text style={styles.cashCaption}>{t.driver.tripActive.gcashAutoConfirmed}</Text>
              )}

              <View style={styles.actions}>
                <View style={styles.actionButton}>
                  <Button
                    label={t.common.cancel}
                    variant="outline"
                    tone="danger"
                    fullWidth
                    disabled={isCompleting || isStarting}
                    onPress={() => setCancellingId(passenger.id)}
                  />
                </View>
                {passenger.status === 'assigned' ? (
                  <View style={styles.actionButton}>
                    <Button
                      label={t.driver.tripActive.start}
                      fullWidth
                      loading={isStarting}
                      onPress={() => handleStart(passenger.id)}
                    />
                  </View>
                ) : (
                  <View style={styles.actionButton}>
                    <Button
                      label={t.driver.tripActive.complete}
                      fullWidth
                      disabled={!canComplete}
                      loading={isCompleting}
                      onPress={() => handleComplete(passenger)}
                    />
                  </View>
                )}
              </View>
            </Card>
          );
        })}

        {incoming && (
          <View>
            <Text style={styles.sectionLabel}>{t.driver.tripActive.compatibleRequest}</Text>
            <RequestCard
              request={incoming}
              accepting={acceptingId === incoming.id}
              onAccept={() => acceptRideRequest(incoming.id)}
              onDecline={() => decline(incoming.id)}
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

        <View style={styles.sosBlock}>
          <HoldToConfirmButton label={t.trip.sosButton} fullWidth onConfirm={() => router.push('/trip/emergency')} />
          <Text style={styles.sosCaption}>{t.trip.sosCaption}</Text>
        </View>

        <Button
          label={t.driver.tripActive.endTrip}
          variant="outline"
          tone="neutral"
          fullWidth
          disabled={hasPassengers}
          onPress={() => setConfirmingEndTrip(true)}
        />
      </MapOverlaySheet>

      <ConfirmModal
        visible={!!cancellingId}
        title={t.driver.tripActive.cancelPassengerTitle}
        message={t.driver.tripActive.cancelPassengerMessage}
        cancelLabel={t.driver.tripActive.keep}
        confirmLabel={t.driver.tripActive.cancelRide}
        destructive
        confirmLoading={confirmingCancel}
        onCancel={() => setCancellingId(null)}
        onConfirm={handleConfirmCancel}
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
    </SafeAreaView>
  );
}
