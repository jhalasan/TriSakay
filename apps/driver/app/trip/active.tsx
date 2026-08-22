import { useEffect, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, Card, ConfirmModal, HoldToConfirmButton, MapOverlaySheet, OsmMap, Toggle } from '@trisakay/ui';
import { RequestCard } from '../../src/components/RequestCard';
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
  const completePassenger = useTripStore((state) => state.completePassenger);
  const cancelPassenger = useTripStore((state) => state.cancelPassenger);
  const endTrip = useTripStore((state) => state.endTrip);
  const recordCompletedTrip = useDriverStore((state) => state.recordCompletedTrip);

  const pending = useRequestsStore((state) => state.pending);
  const requestError = useRequestsStore((state) => state.error);
  const subscribe = useRequestsStore((state) => state.subscribe);
  const unsubscribe = useRequestsStore((state) => state.unsubscribe);
  const decline = useRequestsStore((state) => state.decline);
  const handleAccept = useAcceptRideRequest();

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [confirmingCashId, setConfirmingCashId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [confirmingEndTrip, setConfirmingEndTrip] = useState(false);
  const [endingTrip, setEndingTrip] = useState(false);

  // FR-2.5c mid-trip pickup — the request board stays live for as long as
  // the trip is active, not just pre-trip like Dashboard's. Matching only
  // ever returns candidates while the driver is available (is_available may
  // already be true from before the trip started) with remaining seats, so
  // this simply surfaces nothing if the driver went offline or the trip is
  // already at capacity — no separate check needed here.
  useEffect(() => {
    if (!user) return;
    subscribe(user.id);
    return () => unsubscribe();
  }, [user, subscribe, unsubscribe]);

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

  async function handleComplete(passenger: ActivePassenger) {
    if (completingId) return;
    setCompletingId(passenger.id);
    const closed = await completePassenger(passenger.id);
    setCompletingId(null);
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

      <MapOverlaySheet bottomInset={insets.bottom} style={styles.content}>
        {!hasPassengers && <Text style={styles.offlineNote}>{t.driver.tripActive.noPassengersNote}</Text>}

        {trip.passengers.map((passenger) => {
          const isCash = passenger.paymentMethod === 'cash';
          const canComplete = (!isCash || passenger.cashConfirmed) && completingId !== passenger.id;

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
                    onPress={() => setCancellingId(passenger.id)}
                  />
                </View>
                <View style={styles.actionButton}>
                  <Button
                    label={t.driver.tripActive.complete}
                    fullWidth
                    disabled={!canComplete}
                    loading={completingId === passenger.id}
                    onPress={() => handleComplete(passenger)}
                  />
                </View>
              </View>
            </Card>
          );
        })}

        {incoming && (
          <View>
            <Text style={styles.sectionLabel}>{t.driver.tripActive.compatibleRequest}</Text>
            <RequestCard request={incoming} onAccept={() => handleAccept(incoming.id)} onDecline={() => decline(incoming.id)} />
          </View>
        )}

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
