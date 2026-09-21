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
