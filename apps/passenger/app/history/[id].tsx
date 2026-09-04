import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { Avatar, Badge, BrandMotif, Card, EmptyState, GradientSurface, colors } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { useTranslation } from '../../src/hooks/useTranslation';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/history/detail.styles';

function formatDateTime(iso: string) {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  const time = date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

export default function RideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslation();
  const item = useHistoryStore((state) => state.items.find((ride) => ride.id === id));

  if (!item) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t.history.detailTitle} />
        <EmptyState title={t.history.notFoundTitle} message={t.history.notFoundMessage} />
      </View>
    );
  }

  const hasRoute = item.pickup && item.dropoff;
  const isDone = item.status === 'done';
  // `item.fare` is already the discounted total the passenger paid — the
  // pre-discount base fare isn't stored separately, so it's backed out from
  // the percent that is.
  const showFareBreakdown = item.discountApplied && item.discountPercent != null && item.discountPercent > 0;
  const baseFare = showFareBreakdown ? item.fare / (1 - item.discountPercent! / 100) : null;
  const discountAmount = baseFare != null ? baseFare - item.fare : null;

  return (
    <View style={styles.container}>
      <ScreenHeader title={t.history.detailTitle} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summaryShadowWrap}>
          <GradientSurface token="hero" direction="diagonal" style={styles.summaryCard}>
            <BrandMotif size={160} color={colors.white} opacity={0.12} style={styles.summaryMotif} />
            <View style={styles.summaryTopRow}>
              <Badge label={isDone ? t.history.completed : t.history.cancelled} tone={isDone ? 'green' : 'danger'} />
              <Text style={styles.dateTimeText}>{formatDateTime(item.date)}</Text>
            </View>
            <Text style={styles.fareEyebrow}>{t.history.totalFare}</Text>
            <Text style={styles.fareText}>{formatCurrency(item.fare)}</Text>
            {item.discountApplied && (
              <View style={styles.discountRow}>
                <Ionicons name="pricetag-outline" size={13} color={colors.accentGreenSoft} />
                <Text style={styles.discountText}>
                  {item.discountPercent != null
                    ? `${item.discountPercent}${t.history.discountAppliedSuffix}`
                    : t.history.discountAppliedGeneric}
                </Text>
              </View>
            )}
          </GradientSurface>
        </View>

        {hasRoute && (
          <Card variant="raised" style={styles.section}>
            <Text style={styles.sectionLabel}>{t.history.route}</Text>
            <View style={styles.routeBlock}>
              <View style={styles.routeMarkerCol}>
                <View style={styles.routeDotPickup} />
                <View style={styles.routeLine} />
                <View style={styles.routeDotDropoff} />
              </View>
              <View style={styles.routeTextCol}>
                <View>
                  <Text style={styles.routeLabel}>{t.history.pickup}</Text>
                  <Text style={styles.routeAddress}>{item.pickup}</Text>
                </View>
                <View>
                  <Text style={styles.routeLabel}>{t.history.dropoff}</Text>
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
                      {Math.round(item.durationMinutes)} {t.history.minutesSuffix}
                    </Text>
                  </View>
                )}
                {item.seats != null && (
                  <View style={styles.distanceItem}>
                    <Ionicons name="person-outline" size={14} color={colors.inkSoft} />
                    <Text style={styles.distanceText}>
                      {item.seats} {t.history.seatsSuffix}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Card>
        )}

        {item.driverName && (
          <Card variant="raised" style={styles.section}>
            <Text style={styles.sectionLabel}>{t.history.driver}</Text>
            <View style={styles.driverRow}>
              <Avatar name={item.driverName} size="md" />
              <View style={styles.driverTextSlot}>
                <Text style={styles.driverName}>{item.driverName}</Text>
                {(item.bodyNo || item.plateNo) && (
                  <View style={styles.driverPlateRow}>
                    <Ionicons name="shield-checkmark" size={13} color={colors.accentGreen} />
                    <Text style={styles.driverPlateText}>
                      {[item.bodyNo && `${t.history.bodyNoPrefix} ${item.bodyNo}`, item.plateNo]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                )}
              </View>
              {item.driverRating != null && item.driverRating > 0 && (
                <View style={styles.driverRatingBadge}>
                  <Ionicons name="star" size={14} color={colors.accentGreen} />
                  <Text style={styles.driverRatingText}>{item.driverRating.toFixed(1)}</Text>
                </View>
              )}
            </View>
          </Card>
        )}

        <Card variant="raised" style={styles.section}>
          <Text style={styles.sectionLabel}>{t.history.payment}</Text>
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
          <View style={styles.paymentDivider} />
          {showFareBreakdown && baseFare != null && discountAmount != null && (
            <>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentBreakdownLabel}>{t.history.baseFare}</Text>
                <Text style={styles.paymentBreakdownValue}>{formatCurrency(baseFare)}</Text>
              </View>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentBreakdownLabel}>{t.history.discountLabel}</Text>
                <Text style={styles.paymentDiscountValue}>−{formatCurrency(discountAmount)}</Text>
              </View>
              <View style={styles.paymentDivider} />
            </>
          )}
          <View style={styles.paymentRow}>
            <Text style={styles.totalLabel}>{t.history.total}</Text>
            <Text style={styles.totalValue}>{formatCurrency(item.fare)}</Text>
          </View>
        </Card>

        {item.status === 'cancelled' && item.cancelReason && (
          <Card variant="raised" style={styles.section}>
            <Text style={styles.sectionLabel}>{t.history.cancellationReason}</Text>
            <Text style={styles.cancelReasonText}>{item.cancelReason}</Text>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
