import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Avatar, BrandMotif, Button, Card, GradientSurface, colors } from '@trisakay/ui';
import { useBookingStore } from '../../src/store/useBookingStore';
import { useTranslation } from '../../src/hooks/useTranslation';
import { formatCurrency } from '../../src/utils/currency';
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

  const paymentLabel = paymentMethod === 'gcash' ? t.common.gcash : t.common.cash;

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
          {pickup && dropoff && (
            <View style={styles.routeRow}>
              <View style={styles.routeDots}>
                <View style={styles.routeDotPickup} />
                <View style={styles.routeLine} />
                <View style={styles.routeDotDropoff} />
              </View>
              <View style={styles.routeLabels}>
                <Text style={styles.routeLabel} numberOfLines={1}>{pickup.label}</Text>
                <Text style={styles.routeLabel} numberOfLines={1}>{dropoff.label}</Text>
              </View>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t.tripComplete.fareLabel}</Text>
            <Text style={styles.summaryValue}>{fare === null ? '—' : formatCurrency(fare)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t.tripComplete.paidViaLabel}</Text>
            <Text style={styles.summaryValue}>{paymentLabel}</Text>
          </View>
          {distanceKm !== null && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t.tripComplete.distanceLabel}</Text>
              <Text style={styles.summaryValue}>{distanceKm.toFixed(1)} km</Text>
            </View>
          )}
        </Card>

        {driver && (
          <Card variant="raised" style={styles.driverCard}>
            <Avatar name={driver.name} size="md" />
            <View style={styles.driverTextSlot}>
              <Text style={styles.driverName}>{driver.name ?? t.rateDriver.yourDriverFallback}</Text>
              {driver.plateNumber ? <Text style={styles.driverPlate}>{driver.plateNumber}</Text> : null}
            </View>
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
