import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { createRideRequest, estimateFare, getFareDiscountRate, getMyDiscount } from '@trisakay/services';
import { haversineDistanceKm } from '@trisakay/utils';
import {
  Badge,
  Button,
  Card,
  MapOverlaySheet,
  OsmMap,
  SegmentedControl,
  Stepper,
  colors,
} from '@trisakay/ui';
import { LOCATION_REQUIRED_HINT, LocationRequiredNotice } from '../../src/components/LocationRequiredNotice';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useLocationPermission } from '../../src/hooks/useLocationPermission';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useBookingStore } from '../../src/store/useBookingStore';
import { formatCurrency } from '../../src/utils/currency';
import { fetchRouteEstimate, type RouteEstimate } from '../../src/utils/route';
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
  const setDistanceKm = useBookingStore((state) => state.setDistanceKm);
  const setPaymentMethod = useBookingStore((state) => state.setPaymentMethod);
  const setTripStatus = useBookingStore((state) => state.setTripStatus);
  const rideRequestId = useBookingStore((state) => state.rideRequestId);
  const setRideRequestId = useBookingStore((state) => state.setRideRequestId);
  const { isGranted } = useLocationPermission();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const [fareError, setFareError] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  // null while unresolved — the discount line only ever renders once we
  // actually know the passenger's status, never a guess.
  const [discountApproved, setDiscountApproved] = useState<boolean | null>(null);
  const [discountRatePercent, setDiscountRatePercent] = useState<number | null>(null);
  const [route, setRoute] = useState<RouteEstimate | null>(null);
  // True once we definitively know whether the passenger has an approved
  // discount AND (if so) what rate applies — gates the request button so we
  // never persist a guessed discount_percent.
  const discountInfoReady =
    discountApproved !== null && (discountApproved === false || discountRatePercent !== null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    getMyDiscount().then((result) => {
      if (!cancelled) setDiscountApproved(result.data?.status === 'approved');
    });
    getFareDiscountRate().then((result) => {
      if (!cancelled) setDiscountRatePercent(result.discountRatePercent);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Fetch the suggested route (line + road distance) whenever the trip's
  // endpoints change. fetchRouteEstimate never throws — it degrades to a
  // straight line + haversine distance when OSRM is unreachable.
  useEffect(() => {
    if (!pickup || !dropoff) {
      setRoute(null);
      return;
    }
    let cancelled = false;
    fetchRouteEstimate(pickup, dropoff).then((result) => {
      if (!cancelled) setRoute(result);
    });
    return () => {
      cancelled = true;
    };
  }, [pickup, dropoff]);

  useEffect(() => {
    if (!pickup || !dropoff || !route) {
      setFare(null);
      return;
    }

    let cancelled = false;
    setFareError(null);
    estimateFare({ distanceKm: route.distanceKm, seats, passengerId: user?.id }).then((result) => {
      if (cancelled) return;
      setFare(result.fare);
      if (result.error) setFareError(result.error);
    });

    return () => {
      cancelled = true;
    };
  }, [pickup, dropoff, route, seats, user?.id, setFare]);

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
        <ScreenHeader title={t.confirm.title} />
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{t.confirm.noDestinationSelected}</Text>
          <Button label={t.confirm.chooseDestination} onPress={() => router.replace('/booking/set-destination')} />
        </View>
      </View>
    );
  }

  const requestButton = (
    <View style={styles.footer}>
      <Button
        label={t.confirm.requestRide}
        tone="success"
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
  );

  async function handleRequestRide() {
    // A pending request already exists — this shouldn't be reachable in the
    // normal flow once router.replace() is used below, but guards against
    // any other path that could re-invoke this handler (e.g. a stray tap
    // queued before navigation actually replaces this screen).
    if (rideRequestId) return;
    if (!pickup || !dropoff || fare === null || !user?.id) return;

    setIsRequesting(true);
    setRequestError(null);

    const distanceKm = route?.distanceKm ?? haversineDistanceKm(pickup, dropoff);
    setDistanceKm(distanceKm);
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
      setRequestError(error ?? t.confirm.couldNotRequestRide);
      return;
    }

    setRideRequestId(data.id);
    setTripStatus('searching');
    router.replace('/booking/finding-driver');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.mapFill}>
        <OsmMap
          variant="route"
          caption={t.confirm.routePreview}
          height="100%"
          // Midpoint of the trip — only the initial center while the route is
          // still loading; once it arrives the map fits the route bounds instead.
          latitude={midpoint?.latitude}
          longitude={midpoint?.longitude}
          zoom={14}
          interactive
          edgeToEdge
          route={route?.geometry}
        />
      </View>

      <View style={styles.topFloating}>
        <Card variant="raised" style={styles.headerBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color={colors.accentBluePressed} />
          </Pressable>
          <Text style={styles.headerTitle}>{t.confirm.title}</Text>
        </Card>
      </View>

      <MapOverlaySheet bottomInset={insets.bottom}>
        <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollContent}>
          <Card variant="raised" style={styles.routeCard}>
            <View style={styles.routeRow}>
              <View style={[styles.routeIconBadge, { backgroundColor: colors.accentGreenSoft }]}>
                <Ionicons name="radio-button-on" size={16} color={colors.accentGreen} />
              </View>
              <View style={styles.routeTextSlot}>
                <Text style={styles.routeLabel}>{pickup?.label ?? t.confirm.pickupPointFallback}</Text>
                <Text style={styles.routeAddress} numberOfLines={1}>
                  {pickup?.address ?? t.confirm.notSetYetFallback}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t.confirm.change} ${t.confirm.pickupLocationLabel}`}
                onPress={() => router.push('/booking/set-pickup')}
              >
                <Text style={styles.routeChangeLink}>{t.confirm.change}</Text>
              </Pressable>
            </View>
            <View style={styles.routeDivider} />
            <View style={styles.routeRow}>
              <View style={[styles.routeIconBadge, { backgroundColor: colors.accentBlueSoft }]}>
                <Ionicons name="location" size={16} color={colors.accentBlue} />
              </View>
              <View style={styles.routeTextSlot}>
                <Text style={styles.routeLabel}>{dropoff.label}</Text>
                <Text style={styles.routeAddress} numberOfLines={1}>
                  {dropoff.address}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t.confirm.change} ${t.confirm.destinationLabel}`}
                onPress={() => router.push('/booking/set-destination')}
              >
                <Text style={styles.routeChangeLink}>{t.confirm.change}</Text>
              </Pressable>
            </View>
          </Card>

          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>{t.confirm.seats}</Text>
            <Stepper value={seats} onChange={setSeats} min={1} max={6} />
          </View>

          <Card variant="raised" style={styles.fareCard}>
            <View style={styles.fareLabelRow}>
              <View style={styles.fareLabelWithInfo}>
                <Text style={styles.fareLabel}>{t.confirm.estimatedFare}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.confirm.viewFareMatrix}
                  onPress={() => router.push('/profile/fare-matrix')}
                >
                  <Ionicons name="information-circle-outline" size={16} color={colors.white} style={{ opacity: 0.75 }} />
                </Pressable>
              </View>
              {discountApproved && (
                <Badge label={`${discountRatePercent ?? 20}${t.confirm.discountAppliedSuffix}`} tone="green" />
              )}
            </View>
            <Text style={styles.fareValue}>{fare === null ? '—' : formatCurrency(fare)}</Text>
            {route && (<Text style={styles.fareNote}>{t.confirm.roadDistanceLabel} {route.distanceKm.toFixed(1)} km</Text>)}
            <Text style={styles.fareNote}>
              {fareError
                ? t.confirm.couldNotReachFareService
                : fare === null
                  ? t.confirm.estimatingFare
                  : t.confirm.fareConfirmedAtDropoff}
            </Text>
            {discountApproved === false && (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/profile/apply-discount')}
              >
                <Text style={styles.discountLink}>{t.confirm.applyForDiscountPrompt}</Text>
              </Pressable>
            )}
          </Card>

          <View>
            <Text style={styles.sectionLabelSpaced}>{t.confirm.paymentMethod}</Text>
            <SegmentedControl
              options={[
                { label: t.common.gcash, value: 'gcash' },
                { label: t.common.cash, value: 'cash' },
              ]}
              value={paymentMethod}
              onChange={setPaymentMethod}
            />
          </View>

          {requestButton}
        </ScrollView>
      </MapOverlaySheet>
    </SafeAreaView>
  );
}
