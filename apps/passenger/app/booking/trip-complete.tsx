import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPassengerRideReceipt, type PassengerTripHistoryItem } from '@trisakay/services';
import { Avatar, Button, NavyBandHeader, RouteRail, StarPicker, StatCells, colors, recordsPalette, ADAPTIVE_LABEL_PROPS } from '@trisakay/ui';
import { EmailReceiptButton } from '../../src/components/EmailReceiptButton';
import { useBookingStore } from '../../src/store/useBookingStore';
import { useTranslation } from '../../src/hooks/useTranslation';
import { formatCurrency } from '../../src/utils/currency';
import { getReferenceCode } from '../../src/utils/reference';
import { styles } from '../../src/styles/booking/trip-complete.styles';

export default function TripCompleteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const pickup = useBookingStore((state) => state.pickup);
  const dropoff = useBookingStore((state) => state.dropoff);
  const fare = useBookingStore((state) => state.fare);
  const distanceKm = useBookingStore((state) => state.distanceKm);
  const paymentMethod = useBookingStore((state) => state.paymentMethod);
  const driver = useBookingStore((state) => state.driver);
  const rideRequestId = useBookingStore((state) => state.rideRequestId);
  const reset = useBookingStore((state) => state.reset);

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

  const reference = getReferenceCode(rideRequestId);
  const firstName = displayDriverName?.trim().split(/\s+/)[0] ?? null;
  const fareFlagged = !!receipt?.fareFlagged && !!rideRequestId;

  // "settled" is only claimed once the server says the payment is paid (or hasn't answered yet, matching the old blanket subtitle).
  const settled = !receipt || receipt.paymentStatus === 'paid';
  const payLine =
    displayPaymentMethod === 'gcash'
      ? settled
        ? t.tripComplete.paidWithGcashSettled
        : t.history.paidWithGcash
      : t.history.paidInCash;

  const statCells = [
    ...(displayDistanceKm !== null ? [{ value: `${displayDistanceKm.toFixed(1)} km`, caption: t.tripComplete.distanceCaption }] : []),
    ...(reference ? [{ value: `#${reference}`, caption: t.tripComplete.tripRefCaption, mono: true }] : []),
  ];

  function handleSkip() {
    reset();
    router.replace('/(tabs)/home');
  }

  function handleRate(score?: number) {
    router.replace(score ? { pathname: '/booking/rate-driver', params: { initialScore: String(score) } } : '/booking/rate-driver');
  }

  const journeyCard =
    displayPickupLabel && displayDropoffLabel ? (
      <View style={styles.cardHero}>
        <View style={styles.routePad}>
          <RouteRail pickup={{ name: displayPickupLabel }} dropoff={{ name: displayDropoffLabel }} gap={14} />
        </View>
        {statCells.length > 0 && <StatCells cells={statCells} />}
      </View>
    ) : null;

  const rateCard =
    displayDriverName || displayDriverPlate ? (
      <View style={[styles.rateCard, styles.softShadow]}>
        <View style={styles.driverRow}>
          <Avatar name={displayDriverName ?? undefined} size="md" />
          <Text style={styles.driverName} numberOfLines={1}>
            {displayDriverName || t.rateDriver.yourDriverFallback}
          </Text>
          {displayDriverPlate ? (
            <View style={styles.plateTag}>
              <Text style={styles.plateText}>{displayDriverPlate}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.hairline} />
        <Text style={styles.rateTitle}>{t.rateDriver.howWasYourRide}</Text>
        <StarPicker
          value={0}
          size={36}
          gap={8}
          emptyColor={colors.line}
          activeColor={colors.accentBlue}
          accessibilityLabel={t.rateDriver.ratingA11y}
          starLabel={(n) => t.rateDriver.starA11y.replace('{n}', String(n))}
          onChange={(n) => handleRate(n)}
        />
        <Text style={styles.rateHint}>
          {t.tripComplete.tapToRate.replace('{name}', firstName ?? t.rateDriver.yourDriverFallback.toLowerCase())}
        </Text>
      </View>
    ) : null;

  const flaggedCard = fareFlagged ? (
    <View style={[styles.amberCard, styles.heroShadow]}>
      <View style={styles.amberTop}>
        <View style={styles.amberTile}>
          <Ionicons name="alert-circle" size={20} color={recordsPalette.amberIcon} />
        </View>
        <View style={styles.amberText}>
          <Text style={styles.amberTitle}>{t.tripComplete.fareFlaggedTitle}</Text>
          <Text style={styles.amberBody}>{t.tripComplete.fareFlaggedNotice}</Text>
        </View>
      </View>
      {displayDropoffLabel && (
        <View style={styles.compare}>
          {/* D4: the ride's end address isn't returned by the history RPC yet, so only the booked destination is shown. */}
          <View style={styles.compareRow}>
            <Text style={styles.compareLabel}>{t.tripComplete.fareFlaggedBooked}</Text>
            <Text style={styles.compareValue} numberOfLines={2}>
              {displayDropoffLabel}
            </Text>
          </View>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/complaints/new', params: { rideRequestId: rideRequestId!, category: 'fare' } })}
        style={styles.reportButton}
      >
        <Ionicons name="flag" size={16} color={colors.white} />
        <Text {...ADAPTIVE_LABEL_PROPS} style={styles.reportButtonText}>{t.tripComplete.reportFareIssueButton}</Text>
      </Pressable>
    </View>
  ) : null;

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 130 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <NavyBandHeader topInset={insets.top} overlapBottom>
          <View style={styles.bandCenter}>
            <View style={styles.haloOuter}>
              <View style={styles.haloInner}>
                <Ionicons name="checkmark" size={26} color={colors.accentGreenPressed} />
              </View>
            </View>
            <Text style={styles.arrived}>{t.tripComplete.arrivedTitle}</Text>
            <Text style={styles.fare}>{displayFare === null ? '—' : formatCurrency(displayFare)}</Text>
            <View style={styles.payRow}>
              <Ionicons name={displayPaymentMethod === 'gcash' ? 'wallet-outline' : 'cash-outline'} size={15} color={colors.white} />
              <Text style={styles.payText}>{payLine}</Text>
            </View>
          </View>
        </NavyBandHeader>

        <View style={styles.content}>
          {fareFlagged ? (
            <>
              {flaggedCard}
              {journeyCard && <View style={styles.softShadow}>{journeyCard}</View>}
            </>
          ) : (
            journeyCard && <View style={styles.heroShadow}>{journeyCard}</View>
          )}
          {rateCard}
          {rideRequestId && <EmailReceiptButton rideRequestId={rideRequestId} />}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(14, insets.bottom + 6) }]}>
        <Button
          label={firstName ? t.tripComplete.rateCta.replace('{name}', firstName) : t.tripComplete.rateCtaGeneric}
          fullWidth
          onPress={() => handleRate()}
        />
        <Pressable accessibilityRole="button" onPress={handleSkip} style={styles.skipButton}>
          <Text {...ADAPTIVE_LABEL_PROPS} style={styles.skipText}>{t.rateDriver.skipForNow}</Text>
        </Pressable>
      </View>
    </View>
  );
}
