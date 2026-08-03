import { useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, ConfirmModal, OsmMap, Toggle } from '@trisakay/ui';
import { useDriverStore } from '../../src/store/useDriverStore';
import { useEarningsStore } from '../../src/store/useEarningsStore';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { useTripStore } from '../../src/store/useTripStore';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/trip/active.styles';

export default function ActiveTripScreen() {
  const router = useRouter();
  const trip = useTripStore((state) => state.current);
  const confirmCash = useTripStore((state) => state.confirmCash);
  const complete = useTripStore((state) => state.complete);
  const cancel = useTripStore((state) => state.cancel);
  const addTrip = useHistoryStore((state) => state.addTrip);
  const creditTrip = useEarningsStore((state) => state.creditTrip);
  const recordCompletedTrip = useDriverStore((state) => state.recordCompletedTrip);

  const [cancelling, setCancelling] = useState(false);

  if (!trip) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  const isCash = trip.paymentMethod === 'cash';
  const canComplete = !isCash || trip.cashConfirmed;

  function handleComplete() {
    const closed = complete();
    if (!closed) return;
    const fare = closed.fare ?? 0;
    addTrip({ id: closed.id, passengerName: closed.passengerName, date: new Date().toISOString(), fare: closed.fare, status: 'done' });
    creditTrip(fare);
    recordCompletedTrip(fare);
    router.replace('/(tabs)/dashboard');
  }

  function handleConfirmCancel() {
    const closed = cancel();
    setCancelling(false);
    if (!closed) return;
    addTrip({ id: closed.id, passengerName: closed.passengerName, date: new Date().toISOString(), fare: closed.fare, status: 'cancelled' });
    router.replace('/(tabs)/dashboard');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.mapWrap}>
        <OsmMap variant="route" caption="Map · trip route" height="100%" interactive={false} />
      </View>
      <View style={styles.statusBadgeWrap}>
        <Badge label="In progress" tone="blue" dot />
      </View>

      <View style={styles.content}>
        <View style={styles.passengerRow}>
          <Avatar name={trip.passengerName ?? undefined} size="lg" />
          <View>
            <Text style={styles.passengerName}>{trip.passengerName || 'Passenger'}</Text>
            <Text style={styles.seatsLabel}>
              {trip.seats} seat{trip.seats > 1 ? 's' : ''} · {trip.fare !== null ? formatCurrency(trip.fare) : '—'}
            </Text>
          </View>
        </View>

        <View style={styles.cashCard}>
          {isCash ? (
            <>
              <View style={styles.cashRow}>
                <Text style={styles.cashLabel}>Confirm cash received</Text>
                <Toggle value={trip.cashConfirmed} onValueChange={confirmCash} disabled={trip.cashConfirmed} />
              </View>
              <Text style={styles.cashCaption}>CASH TRIPS ONLY — GCASH IS AUTO-CONFIRMED BY THE PAYMENT WEBHOOK</Text>
            </>
          ) : (
            <Text style={styles.cashCaption}>CASH TRIPS ONLY — GCASH IS AUTO-CONFIRMED BY THE PAYMENT WEBHOOK</Text>
          )}
        </View>

        <View style={styles.actions}>
          <View style={styles.actionButton}>
            <Button label="Cancel" variant="outline" tone="danger" fullWidth onPress={() => setCancelling(true)} />
          </View>
          <View style={styles.actionButton}>
            <Button label="Complete trip" fullWidth disabled={!canComplete} onPress={handleComplete} />
          </View>
        </View>
      </View>

      <ConfirmModal
        visible={cancelling}
        title="Cancel this trip?"
        message="The trip will be logged as cancelled."
        cancelLabel="Keep trip"
        confirmLabel="Cancel trip"
        destructive
        onCancel={() => setCancelling(false)}
        onConfirm={handleConfirmCancel}
      />
    </SafeAreaView>
  );
}
