import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { Avatar, Badge, BrandMotif, Card, EmptyState, GradientSurface, colors } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { useTranslation } from '../../src/hooks/useTranslation';
import { formatCurrency } from '../../src/utils/currency';
import { getReferenceCode } from '../../src/utils/reference';
import { styles } from '../../src/styles/history/detail.styles';

function formatDateTime(iso: string) {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  const time = date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslation();
  const item = useHistoryStore((state) => state.trips.find((trip) => trip.id === id));

  if (!item) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t.driver.history.detailTitle} />
        <EmptyState title={t.driver.history.notFoundTitle} message={t.driver.history.notFoundMessage} />
      </View>
    );
  }

  const isDone = item.status === 'done';
  const reference = getReferenceCode(item.id);
  const hasRoute = item.pickup && item.dropoff;

  return (
    <View style={styles.container}>
      <ScreenHeader title={t.driver.history.detailTitle} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summaryShadowWrap}>
          <GradientSurface token="hero" direction="diagonal" style={styles.summaryCard}>
            <BrandMotif size={160} color={colors.white} opacity={0.12} style={styles.summaryMotif} />
            <View style={styles.summaryTopRow}>
              <Badge label={isDone ? t.driver.history.done : t.driver.history.filterCancelled} tone={isDone ? 'green' : 'danger'} />
              <Text style={styles.dateTimeText}>{formatDateTime(item.date)}</Text>
            </View>
            <Text style={styles.fareEyebrow}>{t.driver.history.totalFare}</Text>
            <Text style={styles.fareText}>{item.fare !== null ? formatCurrency(item.fare) : '—'}</Text>
          </GradientSurface>
        </View>

        <Card variant="raised" style={styles.section}>
          <Text style={styles.sectionLabel}>{t.driver.history.passenger}</Text>
          <View style={styles.passengerRow}>
            <Avatar name={item.passengerName ?? undefined} size="md" />
            <Text style={styles.passengerName}>{item.passengerName || t.driver.history.passengerFallback}</Text>
          </View>
        </Card>

        {hasRoute && (
          <Card variant="raised" style={styles.section}>
            <Text style={styles.sectionLabel}>{t.driver.history.route}</Text>
            <View style={styles.routeBlock}>
              <View style={styles.routeMarkerCol}>
                <View style={styles.routeDotPickup} />
                <View style={styles.routeLine} />
                <View style={styles.routeDotDropoff} />
              </View>
              <View style={styles.routeTextCol}>
                <View>
                  <Text style={styles.routeLabel}>{t.driver.history.pickup}</Text>
                  <Text style={styles.routeAddress}>{item.pickup}</Text>
                </View>
                <View>
                  <Text style={styles.routeLabel}>{t.driver.history.dropoff}</Text>
                  <Text style={styles.routeAddress}>{item.dropoff}</Text>
                </View>
              </View>
            </View>
            {(item.distanceKm != null || item.durationMinutes != null || item.seats != null) && (
              <View style={styles.distanceRow}>
                {item.distanceKm != null && (
                  <View style={styles.distanceItem}>
                    <Ionicons name="navigate-outline" size={14} color={colors.inkSoft} />
                    <Text style={styles.distanceText}>{item.distanceKm.toFixed(1)} km</Text>
                  </View>
                )}
                {item.durationMinutes != null && (
                  <View style={styles.distanceItem}>
                    <Ionicons name="time-outline" size={14} color={colors.inkSoft} />
                    <Text style={styles.distanceText}>
                      {Math.round(item.durationMinutes)} {t.driver.history.minutesSuffix}
                    </Text>
                  </View>
                )}
                {item.seats != null && (
                  <View style={styles.distanceItem}>
                    <Ionicons name="person-outline" size={14} color={colors.inkSoft} />
                    <Text style={styles.distanceText}>
                      {item.seats} {t.driver.history.seatsSuffix}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Card>
        )}

        <Card variant="raised" style={styles.section}>
          <Text style={styles.sectionLabel}>{t.driver.history.payment}</Text>
          <View style={styles.paymentRow}>
            <View style={styles.paymentMethodLabel}>
              <Ionicons
                name={item.paymentMethod === 'gcash' ? 'wallet-outline' : 'cash-outline'}
                size={16}
                color={colors.inkSoft}
              />
              <Text style={styles.paymentMethodText}>
                {item.paymentMethod === 'gcash' ? 'GCash' : item.paymentMethod === 'cash' ? 'Cash' : 'No payment'}
              </Text>
            </View>
            {item.paymentStatus && (
              <Badge
                label={item.paymentStatus.charAt(0).toUpperCase() + item.paymentStatus.slice(1)}
                tone={item.paymentStatus === 'paid' ? 'green' : item.paymentStatus === 'failed' ? 'danger' : 'blue'}
              />
            )}
          </View>
        </Card>

        {item.status === 'cancelled' && item.cancelReason && (
          <Card variant="raised" style={styles.section}>
            <Text style={styles.sectionLabel}>{t.driver.history.cancellationReason}</Text>
            <Text style={styles.cancelReasonText}>{item.cancelReason}</Text>
          </Card>
        )}

        {reference && (
          <Card variant="raised" style={styles.section}>
            <View style={styles.referenceRow}>
              <Text style={styles.referenceLabel}>{t.driver.history.tripReference}</Text>
              <Text style={styles.referenceValue}>#{reference}</Text>
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
