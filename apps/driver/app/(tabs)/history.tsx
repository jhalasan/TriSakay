import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Badge, BrandMotif, EmptyState, GradientSurface, colors } from '@trisakay/ui';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/tabs/history.styles';

type FilterMode = 'all' | 'done' | 'cancelled';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function isThisMonth(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export default function HistoryScreen() {
  const t = useTranslation();
  const trips = useHistoryStore((state) => state.trips);
  const loading = useHistoryStore((state) => state.loading);
  const historyError = useHistoryStore((state) => state.error);
  const load = useHistoryStore((state) => state.load);
  const [filter, setFilter] = useState<FilterMode>('all');

  const filterOptions = [
    { value: 'all' as const, label: t.driver.history.filterAll },
    { value: 'done' as const, label: t.driver.history.filterDone },
    { value: 'cancelled' as const, label: t.driver.history.filterCancelled },
  ];

  useEffect(() => {
    void load();
  }, [load]);

  const filteredTrips = useMemo(() => {
    if (filter === 'all') return trips;
    return trips.filter((trip) => trip.status === filter);
  }, [trips, filter]);

  const thisMonthSummary = useMemo(() => {
    const monthTrips = trips.filter((trip) => isThisMonth(trip.date));
    const total = monthTrips
      .filter((trip) => trip.status === 'done' && trip.fare !== null)
      .reduce((sum, trip) => sum + (trip.fare ?? 0), 0);
    const tripWord = monthTrips.length === 1 ? t.driver.history.tripSuffix : t.driver.history.tripsSuffix;
    return `${monthTrips.length} ${tripWord} · ${formatCurrency(total)}`;
  }, [trips, t]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.heroShadow}>
        <GradientSurface token="hero" direction="diagonal" style={styles.heroBand}>
          <BrandMotif size={200} color={colors.white} opacity={0.12} style={styles.motif} />
          <Text style={styles.heroEyebrow}>{t.driver.history.eyebrow}</Text>
          <Text style={styles.heroTitle}>{t.driver.history.title}</Text>
          <View style={styles.filterRow}>
            {filterOptions.map((option) => {
              const active = option.value === filter;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setFilter(option.value)}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                >
                  <Text style={[styles.filterPillLabel, active && styles.filterPillLabelActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </GradientSurface>
      </View>

      {historyError && <Text style={styles.error}>{historyError}</Text>}

      <FlatList
        data={filteredTrips}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ListHeaderComponent={
          filteredTrips.length > 0 ? (
            <View style={styles.monthRow}>
              <Text style={styles.monthLabel}>{t.driver.history.thisMonth}</Text>
              <Text style={styles.monthSummary}>{thisMonthSummary}</Text>
            </View>
          ) : null
        }
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
