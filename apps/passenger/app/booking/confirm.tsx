import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import {
  Button,
  Card,
  MapPlaceholder,
  SegmentedControl,
  Stepper,
  colors,
} from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useBookingStore } from '../../src/store/useBookingStore';
import { estimateFare } from '../../src/mocks/fareCalculator';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from './confirm.styles';

export default function ConfirmScreen() {
  const router = useRouter();
  const pickup = useBookingStore((state) => state.pickup);
  const dropoff = useBookingStore((state) => state.dropoff);
  const seats = useBookingStore((state) => state.seats);
  const fare = useBookingStore((state) => state.fare);
  const paymentMethod = useBookingStore((state) => state.paymentMethod);
  const setSeats = useBookingStore((state) => state.setSeats);
  const setFare = useBookingStore((state) => state.setFare);
  const setPaymentMethod = useBookingStore((state) => state.setPaymentMethod);
  const setTripStatus = useBookingStore((state) => state.setTripStatus);

  useEffect(() => {
    setFare(estimateFare(seats));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seats]);

  if (!dropoff) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Confirm ride" />
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No destination selected yet.</Text>
          <Button label="Choose a destination" onPress={() => router.replace('/booking/set-destination')} />
        </View>
      </View>
    );
  }

  function handleRequestRide() {
    setTripStatus('searching');
    router.push('/booking/finding-driver');
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Confirm ride" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <MapPlaceholder variant="route" caption="Route preview" height={180} />

        <Card style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: colors.accentGreen }]} />
            <View style={styles.routeTextSlot}>
              <Text style={styles.routeLabel}>{pickup.label}</Text>
              <Text style={styles.routeAddress}>{pickup.address}</Text>
            </View>
          </View>
          <View style={styles.routeDivider} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: colors.accentBlue }]} />
            <View style={styles.routeTextSlot}>
              <Text style={styles.routeLabel}>{dropoff.label}</Text>
              <Text style={styles.routeAddress}>{dropoff.address}</Text>
            </View>
          </View>
        </Card>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Seats</Text>
          <Stepper value={seats} onChange={setSeats} min={1} max={4} />
        </View>

        <Card style={styles.fareCard}>
          <Text style={styles.fareLabel}>Estimated fare</Text>
          <Text style={styles.fareValue}>{formatCurrency(fare ?? estimateFare(seats))}</Text>
          <Text style={styles.fareNote}>Final fare is confirmed at drop-off</Text>
        </Card>

        <View>
          <Text style={styles.sectionLabelSpaced}>Payment method</Text>
          <SegmentedControl
            options={[
              { label: 'GCash', value: 'gcash' },
              { label: 'Cash', value: 'cash' },
            ]}
            value={paymentMethod}
            onChange={setPaymentMethod}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Request ride" fullWidth onPress={handleRequestRide} />
      </View>
    </View>
  );
}
