import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { haversineDistanceKm } from '@trisakay/utils';
import {
  Badge,
  Button,
  Card,
  OsmMap,
  SegmentedControl,
  Stepper,
  colors,
} from '@trisakay/ui';
import { LOCATION_REQUIRED_HINT, LocationRequiredNotice } from '../../src/components/LocationRequiredNotice';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useLocationPermission } from '../../src/hooks/useLocationPermission';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useBookingStore } from '../../src/store/useBookingStore';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/booking/confirm.styles';

export default function ConfirmScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const pickup = useBookingStore((state) => state.pickup);
  const dropoff = useBookingStore((state) => state.dropoff);
  const seats = useBookingStore((state) => state.seats);
  const fare = useBookingStore((state) => state.fare);
  const paymentMethod = useBookingStore((state) => state.paymentMethod);
  const setSeats = useBookingStore((state) => state.setSeats);
  const setFare = useBookingStore((state) => state.setFare);
  const setPaymentMethod = useBookingStore((state) => state.setPaymentMethod);
  const setTripStatus = useBookingStore((state) => state.setTripStatus);
  const rideRequestId = useBookingStore((state) => state.rideRequestId);
  const setRideRequestId = useBookingStore((state) => state.setRideRequestId);
  const { isGranted } = useLocationPermission();
  const [fareError, setFareError] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  // null while unresolved — the discount line only ever renders once we
  // actually know the passenger's status, never a guess.
  const [discountApproved, setDiscountApproved] = useState<boolean | null>(null);
  const [discountRatePercent, setDiscountRatePercent] = useState<number | null>(null);
  // True once we definitively know whether the passenger has an approved
  // discount AND (if so) what rate applies — gates the request button so we
  // never persist a guessed discount_percent.
  const discountInfoReady =
    discountApproved !== null && (discountApproved === false || discountRatePercent !== null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    import('@trisakay/services').then(({ getMyDiscount, getFareDiscountRate }) => {
      getMyDiscount().then((result) => {
        if (!cancelled) setDiscountApproved(result.data?.status === 'approved');
      });
      getFareDiscountRate().then((result) => {
        if (!cancelled) setDiscountRatePercent(result.discountRatePercent);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!pickup || !dropoff) {
      setFare(null);
      return;
    }

    let cancelled = false;
    const distanceKm = haversineDistanceKm(pickup, dropoff);

    setFareError(null);
    import('@trisakay/services').then(({ estimateFare }) =>
      estimateFare({ distanceKm, seats, passengerId: user?.id }).then((result) => {
        if (cancelled) return;
        setFare(result.fare);
        if (result.error) setFareError(result.error);
      }),
    );

    return () => {
      cancelled = true;
    };
  }, [pickup, dropoff, seats, user?.id, setFare]);

  /**
   * Both ends of the trip in one frame. Falls back to the service-area centre
   * inside OsmMap when pickup has not been resolved yet.
   */
  const midpoint =
    pickup && dropoff
      ? {
          latitude: (pickup.latitude + dropoff.latitude) / 2,
          longitude: (pickup.longitude + dropoff.longitude) / 2,
        }
      : dropoff;

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

  async function handleRequestRide() {
    // A pending request already exists — this shouldn't be reachable in the
    // normal flow once router.replace() is used below, but guards against
    // any other path that could re-invoke this handler (e.g. a stray tap
    // queued before navigation actually replaces this screen).
    if (rideRequestId) return;
    if (!pickup || !dropoff || fare === null || !user?.id) return;

    setIsRequesting(true);
    setRequestError(null);

    const { createRideRequest } = await import('@trisakay/services');
    const distanceKm = haversineDistanceKm(pickup, dropoff);
    const { data, error } = await createRideRequest({
      passengerId: user.id,
      pickup: { latitude: pickup.latitude, longitude: pickup.longitude, label: pickup.label },
      dropoff: { latitude: dropoff.latitude, longitude: dropoff.longitude, label: dropoff.label },
      seats,
      distanceKm,
      estimatedFare: fare,
      preferredMethod: paymentMethod,
      discountApplied: discountApproved === true,
      discountPercent: discountApproved === true ? discountRatePercent : null,
    });

    setIsRequesting(false);

    if (error || !data) {
      setRequestError(error ?? 'Could not request a ride. Please try again.');
      return;
    }

    setRideRequestId(data.id);
    setTripStatus('searching');
    router.replace('/booking/finding-driver');
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Confirm ride" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <OsmMap
          variant="route"
          caption="Route preview"
          height={180}
          // Midpoint of the trip, so both ends are plausibly in frame until the
          // route line and fit-bounds arrive in the next step.
          latitude={midpoint?.latitude}
          longitude={midpoint?.longitude}
          zoom={14}
          interactive
        />

        <Card variant="raised" style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: colors.accentGreen }]} />
            <View style={styles.routeTextSlot}>
              <Text style={styles.routeLabel}>{pickup?.label ?? 'Pickup point'}</Text>
              <Text style={styles.routeAddress}>{pickup?.address ?? 'Not set yet'}</Text>
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

        <Card variant="raised" style={styles.fareCard}>
          <View style={styles.fareLabelRow}>
            <Text style={styles.fareLabel}>Estimated fare</Text>
            {discountApproved && (
              <Badge label={`${discountRatePercent ?? 20}% discount applied`} tone="green" />
            )}
          </View>
          <Text style={styles.fareValue}>{fare === null ? '—' : formatCurrency(fare)}</Text>
          <Text style={styles.fareNote}>
            {fareError
              ? 'Could not reach the fare service.'
              : fare === null
                ? 'Estimating fare…'
                : 'Final fare is confirmed at drop-off'}
          </Text>
          {discountApproved === false && (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/profile/apply-discount')}
            >
              <Text style={styles.discountLink}>Senior, PWD, or student? Apply for a fare discount</Text>
            </Pressable>
          )}
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
        <Button
          label="Request ride"
          fullWidth
          loading={isRequesting}
          disabled={!isGranted || fare === null || fareError !== null || isRequesting || !discountInfoReady}
          // Only while disabled — an enabled button must not announce a reason
          // that no longer applies.
          accessibilityHint={isGranted ? undefined : LOCATION_REQUIRED_HINT}
          onPress={handleRequestRide}
        />
        {requestError && <Text style={styles.requestError}>{requestError}</Text>}
        <LocationRequiredNotice />
      </View>
    </View>
  );
}
