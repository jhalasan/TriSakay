import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMotif, EmptyState, GradientSurface, colors } from '@trisakay/ui';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { driverHistoryCancelReasonLabel } from '../../src/utils/cancelReason';
import { formatCurrency } from '../../src/utils/currency';
import { interpolate } from '../../src/utils/interpolate';
import type { TripHistoryItem } from '../../src/types/history';
import { styles } from '../../src/styles/tabs/history.styles';

type FilterMode = 'all' | 'done' | 'cancelled';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayGroupKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayGroupLabel(iso: string, todayLabel: string, yesterdayLabel: string): string {
  const d = new Date(iso);
  if (isSameCalendarDay(d, new Date())) return todayLabel;
  if (isSameCalendarDay(d, new Date(Date.now() - 24 * 60 * 60 * 1000))) return yesterdayLabel;
  return d.toLocaleDateString('en-PH', { weekday: 'long' });
}

function initialsOf(name: string | null): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

interface TripGroup {
  key: string;
  label: string;
  dateLabel: string;
  trips: TripHistoryItem[];
}

function groupTripsByDay(trips: TripHistoryItem[], todayLabel: string, yesterdayLabel: string): TripGroup[] {
  const groups: TripGroup[] = [];
  const indexByKey = new Map<string, number>();
  for (const trip of trips) {
    const key = dayGroupKey(trip.date);
    let index = indexByKey.get(key);
    if (index === undefined) {
      index = groups.length;
      indexByKey.set(key, index);
      groups.push({ key, label: dayGroupLabel(trip.date, todayLabel, yesterdayLabel), dateLabel: formatShortDate(trip.date), trips: [] });
    }
    groups[index].trips.push(trip);
  }
  return groups;
}

function CompletedTripCard({ trip, t, onPress }: { trip: TripHistoryItem; t: ReturnType<typeof useTranslation>; onPress: () => void }) {
  return (
    <Pressable style={styles.completedCard} accessibilityRole="button" onPress={onPress}>
      <View style={styles.cardRow1}>
        <Text style={styles.cardMeta}>
          {formatTime(trip.date)} · {trip.paymentMethod === 'gcash' ? t.driver.requestCard.paymentMethodGcash : t.driver.requestCard.paymentMethodCash}
          {trip.seats !== null ? ` · ${trip.seats} ${t.driver.history.seatsSuffix}` : ''}
        </Text>
        <Text style={styles.cardFare}>{trip.fare !== null ? formatCurrency(trip.fare) : '—'}</Text>
      </View>

      <View style={styles.routeRow}>
        <View style={styles.routeRail}>
          <View style={styles.routeDotPickup} />
          <View style={styles.routeLine} />
          <View style={styles.routeDotDropoff} />
        </View>
        <View style={styles.routeTextCol}>
          <Text style={styles.routeText} numberOfLines={1}>
            {trip.pickup ?? '—'}
          </Text>
          <Text style={styles.routeText} numberOfLines={1}>
            {trip.dropoff ?? '—'}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.footerInitialsCircle}>
          <Text style={styles.footerInitialsText}>{initialsOf(trip.passengerName)}</Text>
        </View>
        <Text style={styles.footerName} numberOfLines={1}>
          {trip.passengerName || t.driver.history.passengerFallback}
        </Text>
        <View style={styles.doneChip}>
          <Ionicons name="checkmark" size={10} color={colors.accentGreenPressed} />
          <Text style={styles.doneChipText}>{t.driver.history.doneChip}</Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color={colors.lineStrong} />
      </View>
    </Pressable>
  );
}

function CancelledTripCard({ trip, t }: { trip: TripHistoryItem; t: ReturnType<typeof useTranslation> }) {
  const reason = driverHistoryCancelReasonLabel(trip, t);
  return (
    <View style={styles.cancelledCard}>
      <View style={styles.cardRow1}>
        <Text style={styles.cardMeta}>{formatTime(trip.date)}</Text>
        <View style={styles.cancelledChip}>
          <Text style={styles.cancelledChipText}>{t.driver.history.cancelledChip}</Text>
        </View>
      </View>
      <Text style={styles.cancelledRouteText} numberOfLines={1}>
        {trip.pickup ?? '—'} → {trip.dropoff ?? '—'}
      </Text>
      {reason && (
        <View style={styles.reasonRow}>
          <Ionicons name="information-circle-outline" size={14} color={colors.inkSoft} />
          <Text style={styles.reasonText}>{reason}</Text>
        </View>
      )}
    </View>
  );
}

export default function HistoryScreen() {
  const t = useTranslation();
  const router = useRouter();
  const trips = useHistoryStore((state) => state.trips);
  const loading = useHistoryStore((state) => state.loading);
  const historyError = useHistoryStore((state) => state.error);
  const load = useHistoryStore((state) => state.load);
  const [filter, setFilter] = useState<FilterMode>('all');

  useEffect(() => {
    void load();
  }, [load]);

  const doneCount = trips.filter((trip) => trip.status === 'done').length;
  const cancelledCount = trips.filter((trip) => trip.status === 'cancelled').length;

  const filterOptions = [
    { value: 'all' as const, label: `${t.driver.history.filterAll} ${trips.length}` },
    { value: 'done' as const, label: `${t.driver.history.filterDone} ${doneCount}` },
    { value: 'cancelled' as const, label: `${t.driver.history.filterCancelled} ${cancelledCount}` },
  ];

  const filteredTrips = useMemo(() => {
    if (filter === 'all') return trips;
    return trips.filter((trip) => trip.status === filter);
  }, [trips, filter]);

  const groups = useMemo(
    () => groupTripsByDay(filteredTrips, t.driver.dashboard.todayLabel, t.driver.dashboard.yesterdayLabel),
    [filteredTrips, t]
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.heroShadow}>
        <GradientSurface token="hero" direction="diagonal" style={styles.heroBand}>
          <BrandMotif size={200} color={colors.white} opacity={0.12} style={styles.motif} />
          <SafeAreaView edges={['top']} style={styles.heroBandInner}>
            <Text style={styles.heroEyebrow}>{t.driver.history.yourTripsEyebrow}</Text>
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
          </SafeAreaView>
        </GradientSurface>
      </View>

      {historyError && <Text style={styles.error}>{historyError}</Text>}

      <ScrollView contentContainerStyle={styles.listContent}>
        {loading && trips.length === 0 ? (
          <>
            <View style={styles.skeletonCard} />
            <View style={styles.skeletonCard} />
            <View style={styles.skeletonCard} />
          </>
        ) : groups.length === 0 ? (
          <EmptyState title={t.driver.history.emptyTitle} message={t.driver.history.emptyMessage} />
        ) : (
          groups.map((group) => {
            const groupDoneTrips = group.trips.filter((trip) => trip.status === 'done');
            const groupSum = groupDoneTrips.reduce((sum, trip) => sum + (trip.fare ?? 0), 0);
            return (
              <View key={group.key}>
                <View style={styles.groupHeaderRow}>
                  <Text style={styles.groupHeaderLeft} numberOfLines={1}>
                    <Text style={styles.groupHeaderDay}>{group.label}</Text> <Text style={styles.groupHeaderDate}>{group.dateLabel}</Text>
                  </Text>
                  <Text style={styles.groupHeaderRight} numberOfLines={1}>
                    {interpolate(t.driver.history.groupSummary, { count: groupDoneTrips.length, sum: formatCurrency(groupSum) })}
                  </Text>
                </View>
                <View style={styles.groupList}>
                  {group.trips.map((trip) =>
                    trip.status === 'done' ? (
                      <CompletedTripCard key={trip.id} trip={trip} t={t} onPress={() => router.push(`/history/${trip.id}`)} />
                    ) : (
                      <CancelledTripCard key={trip.id} trip={trip} t={t} />
                    )
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
