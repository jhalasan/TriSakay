import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { getPassengerRideReceipt, type PassengerTripHistoryItem } from '@trisakay/services';
import { Avatar, BrandMotif, Button, Card, GradientSurface, colors } from '@trisakay/ui';
import { useBookingStore } from '../../src/store/useBookingStore';
import { useTranslation } from '../../src/hooks/useTranslation';
import { formatCurrency } from '../../src/utils/currency';
import { getReferenceCode } from '../../src/utils/reference';
import { styles } from '../../src/styles/booking/trip-complete.styles';

export default function TripCompleteScreen() {
  const router = useRouter();
  const t = useTranslation();
  const pickup = useBookingStore((state) => state.pickup);
  const dropoff = useBookingStore((state) => state.dropoff);
  const fare = useBookingStore((state) => state.fare);
  const distanceKm = useBookingStore((state) => state.distanceKm);
  const paymentMethod = useBookingStore((state) => state.paymentMethod);
  const driver = useBookingStore((state) => state.driver);
  const rideRequestId = useBookingStore((state) => state.rideRequestId);

  // F5 (UAT audit): once the server's own ride record resolves, it replaces
  // the local booking-store snapshot below — a receipt should reflect what
  // the backend actually recorded, not whatever the client happened to hold
  // in memory. Renders from the local snapshot immediately rather than
  // blocking this "trip complete" screen on a round trip (already correct in
  // the overwhelming common case); a slow or failed fetch just leaves it as
  // it already was.
  const [receipt, setReceipt] = useState<PassengerTripHistoryItem | null>(null);

  useEffect(() => {
    if (!rideRequestId) return;
    let cancelled = false;
    getPassengerRideReceipt(rideRequestId).then(({ data }) => {
      if (!cancelled && data) setReceipt(data);
    });
    return () => {
      cancelled = true;
    };
  }, [rideRequestId]);

  const displayFare = receipt?.fare ?? fare;
  const displayDistanceKm = receipt?.distanceKm ?? distanceKm;
  const displayPaymentMethod = receipt?.paymentMethod ?? paymentMethod;
  const displayPickupLabel = receipt?.pickup ?? pickup?.label ?? null;
  const displayDropoffLabel = receipt?.dropoff ?? dropoff?.label ?? null;
  const displayDriverName = receipt?.driverName ?? driver?.name ?? null;
  const displayDriverPlate = receipt?.plateNo ?? driver?.plateNumber ?? null;

  const paymentLabel = displayPaymentMethod === 'gcash' ? t.common.gcash : t.common.cash;
  const reference = getReferenceCode(rideRequestId);

  return (
    <View style={styles.screen}>
      <GradientSurface token="hero" direction="diagonal" style={styles.band}>
        <BrandMotif size={180} color={colors.white} opacity={0.12} style={styles.bandMotif} />
        <View style={styles.iconTile}>
          <Ionicons name="checkmark" size={28} color={colors.accentGreen} />
        </View>
        <Text style={styles.bandTitle}>{t.tripComplete.title}</Text>
        <Text style={styles.bandSubtitle}>{t.tripComplete.subtitle}</Text>
      </GradientSurface>

      <View style={styles.content}>
        <Card variant="raised" style={styles.summaryCard}>
          {displayPickupLabel && displayDropoffLabel && (
            <View style={styles.routeRow}>
              <View style={styles.routeDots}>
                <View style={styles.routeDotPickup} />
                <View style={styles.routeLine} />
                <View style={styles.routeDotDropoff} />
              </View>
              <View style={styles.routeLabels}>
                <Text style={styles.routeLabel} numberOfLines={1}>{displayPickupLabel}</Text>
                <Text style={styles.routeLabel} numberOfLines={1}>{displayDropoffLabel}</Text>
              </View>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t.tripComplete.fareLabel}</Text>
            <Text style={styles.summaryValue}>{displayFare === null ? '—' : formatCurrency(displayFare)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t.tripComplete.paidViaLabel}</Text>
            <Text style={styles.summaryValue}>{paymentLabel}</Text>
          </View>
          {displayDistanceKm !== null && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t.tripComplete.distanceLabel}</Text>
              <Text style={styles.summaryValue}>{displayDistanceKm.toFixed(1)} km</Text>
            </View>
          )}
          {reference && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t.tripComplete.referenceLabel}</Text>
              <Text style={styles.summaryValue}>#{reference}</Text>
            </View>
          )}
        </Card>

        {(displayDriverName || displayDriverPlate) && (
          <Card variant="raised" style={styles.driverCard}>
            <Avatar name={displayDriverName ?? undefined} size="md" />
            <View style={styles.driverTextSlot}>
              <Text style={styles.driverName}>{displayDriverName || t.rateDriver.yourDriverFallback}</Text>
              {displayDriverPlate ? <Text style={styles.driverPlate}>{displayDriverPlate}</Text> : null}
            </View>
          </Card>
        )}

        {receipt?.fareFlagged && rideRequestId && (
          <Card variant="raised" style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t.tripComplete.fareFlaggedNotice}</Text>
            <Button
              label={t.tripComplete.reportFareIssueButton}
              variant="outline"
              fullWidth
              onPress={() =>
                router.push({ pathname: '/complaints/new', params: { rideRequestId, category: 'fare' } })
              }
            />
          </Card>
        )}

        <View style={styles.continueWrap}>
          <Button
            label={t.tripComplete.continueButton}
            fullWidth
            onPress={() => router.replace('/booking/rate-driver')}
          />
        </View>
      </View>
    </View>
  );
}
