import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, EmptyState, colors } from '@trisakay/ui';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/tabs/history.styles';

type FilterMode = 'all' | 'done' | 'cancelled';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export default function HistoryScreen() {
  const t = useTranslation();
  const trips = useHistoryStore((state) => state.trips);
  const loading = useHistoryStore((state) => state.loading);
  const historyError = useHistoryStore((state) => state.error);
  const load = useHistoryStore((state) => state.load);
  const [filter, setFilter] = useState<FilterMode>('all');

  const FILTER_LABEL: Record<FilterMode, string> = {
    all: t.driver.history.filterAll,
    done: t.driver.history.filterDone,
    cancelled: t.driver.history.filterCancelled,
  };
  const NEXT_FILTER: Record<FilterMode, FilterMode> = { all: 'done', done: 'cancelled', cancelled: 'all' };

  useEffect(() => {
    void load();
  }, [load]);

  const filteredTrips = useMemo(() => {
    if (filter === 'all') return trips;
    return trips.filter((trip) => trip.status === filter);
  }, [trips, filter]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.driver.history.title}</Text>
        <Button
          label={FILTER_LABEL[filter]}
          size="sm"
          variant="outline"
          tone="neutral"
          onPress={() => setFilter((current) => NEXT_FILTER[current])}
        />
      </View>

      {historyError && <Text style={styles.error}>{historyError}</Text>}

      <FlatList
        data={filteredTrips}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ListEmptyComponent={
          loading ? null : <EmptyState title={t.driver.history.emptyTitle} message={t.driver.history.emptyMessage} />
        }
        renderItem={({ item }) => (
          <View style={styles.tripCard}>
            {item.passengerName ? (
              <Avatar name={item.passengerName} size="md" />
            ) : (
              <View style={styles.fallbackAvatar}>
                <Ionicons name="person" size={20} color={colors.lineStrong} />
              </View>
            )}
            <View style={styles.tripInfo}>
              <Text style={styles.tripName} numberOfLines={1}>
                {item.passengerName || t.driver.history.passengerFallback}
              </Text>
              <Text style={styles.tripDate}>{formatDate(item.date)}</Text>
            </View>
            <View style={styles.trailingSlot}>
              <Badge
                label={item.status === 'done' ? t.driver.history.done : t.driver.history.filterCancelled}
                tone={item.status === 'done' ? 'green' : 'danger'}
              />
              <Text style={[styles.fareText, item.fare === null && styles.fareTextMuted]}>
                {item.fare !== null ? formatCurrency(item.fare) : '—'}
              </Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
