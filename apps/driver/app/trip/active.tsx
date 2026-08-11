import { useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, Card, ConfirmModal, MapOverlaySheet, OsmMap, Toggle } from '@trisakay/ui';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useDriverStore } from '../../src/store/useDriverStore';
import { useTripStore } from '../../src/store/useTripStore';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/trip/active.styles';

export default function ActiveTripScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const trip = useTripStore((state) => state.current);
  const tripError = useTripStore((state) => state.error);
  const confirmCash = useTripStore((state) => state.confirmCash);
  const complete = useTripStore((state) => state.complete);
  const cancel = useTripStore((state) => state.cancel);
  const recordCompletedTrip = useDriverStore((state) => state.recordCompletedTrip);

  const [cancelling, setCancelling] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [confirmingCash, setConfirmingCash] = useState(false);
  const [completing, setCompleting] = useState(false);

  if (!trip) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  const isCash = trip.paymentMethod === 'cash';
  const canComplete = (!isCash || trip.cashConfirmed) && !completing;

  async function handleConfirmCash() {
    if (!user) return;
    setConfirmingCash(true);
    await confirmCash(user.id);
    setConfirmingCash(false);
  }

  async function handleComplete() {
    if (completing) return;
    setCompleting(true);
    const closed = await complete();
    if (!closed) {
      setCompleting(false);
      return;
    }
    const fare = closed.fare ?? 0;
    // Trip history and total earnings both now read fresh from the backend
    // on their own tabs (get_driver_trip_history / v_driver_earnings) — no
    // local mirror to keep in sync here anymore. recordCompletedTrip below
    // is unrelated: Dashboard's today-stats are still local/session-only.
    recordCompletedTrip(fare);
    router.replace('/(tabs)/dashboard');
  }

  async function handleConfirmCancel() {
    if (confirmingCancel) return;
    setConfirmingCancel(true);
    const closed = await cancel('Cancelled by driver');
    setConfirmingCancel(false);
    setCancelling(false);
    if (!closed) return;
    router.replace('/(tabs)/dashboard');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.mapFill}>
        <OsmMap
          variant="route"
          caption="Map · trip route"
          height="100%"
          interactive={false}
          edgeToEdge
          bottomInset={260}
        />
      </View>
      <View style={styles.statusBadgeWrap}>
        <Badge label="In progress" tone="blue" dot />
      </View>

      <MapOverlaySheet bottomInset={insets.bottom} style={styles.content}>
        <View style={styles.passengerRow}>
          <Avatar
            name={trip.passengerName ?? undefined}
            source={trip.passengerAvatarUrl ? { uri: trip.passengerAvatarUrl } : undefined}
            size="lg"
          />
          <View>
            <Text style={styles.passengerName}>{trip.passengerName || 'Passenger'}</Text>
            <Text style={styles.seatsLabel}>
              {trip.seats} seat{trip.seats > 1 ? 's' : ''} · {trip.fare !== null ? formatCurrency(trip.fare) : '—'}
            </Text>
          </View>
        </View>

        <Card style={styles.cashCard}>
          {isCash ? (
            <>
              <View style={styles.cashRow}>
                <Text style={styles.cashLabel}>Confirm cash received</Text>
                <Toggle
                  value={trip.cashConfirmed}
                  onValueChange={handleConfirmCash}
                  disabled={trip.cashConfirmed || confirmingCash}
                />
              </View>
              <Text style={styles.cashCaption}>CASH TRIPS ONLY — GCASH IS AUTO-CONFIRMED BY THE PAYMENT WEBHOOK</Text>
            </>
          ) : (
            <Text style={styles.cashCaption}>CASH TRIPS ONLY — GCASH IS AUTO-CONFIRMED BY THE PAYMENT WEBHOOK</Text>
          )}
        </Card>

        {tripError && <Text style={styles.error}>{tripError}</Text>}

        <View style={styles.actions}>
          <View style={styles.actionButton}>
            <Button label="Cancel" variant="outline" tone="danger" fullWidth onPress={() => setCancelling(true)} />
          </View>
          <View style={styles.actionButton}>
            <Button label="Complete trip" fullWidth disabled={!canComplete} loading={completing} onPress={handleComplete} />
          </View>
        </View>
      </MapOverlaySheet>

      <ConfirmModal
        visible={cancelling}
        title="Cancel this trip?"
        message="The trip will be logged as cancelled."
        cancelLabel="Keep trip"
        confirmLabel="Cancel trip"
        destructive
        confirmLoading={confirmingCancel}
        onCancel={() => setCancelling(false)}
        onConfirm={handleConfirmCancel}
      />
    </SafeAreaView>
  );
}
