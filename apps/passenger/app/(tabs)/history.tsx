import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Badge, BrandMotif, Button, Card, GradientSurface, colors, motion } from '@trisakay/ui';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh';
import { useTranslation } from '../../src/hooks/useTranslation';
import { formatCurrency } from '../../src/utils/currency';
import type { RideHistoryItem } from '../../src/types/ride';
import { styles } from '../../src/styles/tabs/history.styles';

type FilterMode = 'all' | 'done' | 'cancelled';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

function isThisMonth(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function RideCard({
  item,
  t,
  onPress,
}: {
  item: RideHistoryItem;
  t: ReturnType<typeof useTranslation>;
  onPress: () => void;
}) {
  const hasRoute = Boolean(item.pickup && item.dropoff);
  const isDone = item.status === 'done';

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card variant="raised" style={styles.rideCard}>
        <View style={styles.cardTopRow}>
          <View style={styles.dateTimeRow}>
            <Ionicons name="time-outline" size={13} color={colors.inkFaint} />
            <Text style={styles.dateTimeText}>
              {formatDate(item.date)} · {formatTime(item.date)}
            </Text>
          </View>
          <View style={styles.topRowTrailing}>
            <Badge label={isDone ? t.history.completed : t.history.cancelled} tone={isDone ? 'green' : 'danger'} />
            <Text style={[styles.fareText, !isDone && styles.fareTextCancelled]}>{formatCurrency(item.fare)}</Text>
          </View>
        </View>

        {hasRoute && isDone && (
          <View style={styles.routeBlock}>
            <View style={styles.routeMarkerCol}>
              <View style={styles.routeDotPickup} />
              <View style={styles.routeLine} />
              <View style={styles.routeDotDropoff} />
            </View>
            <View style={styles.routeTextCol}>
              <Text style={styles.routeAddress} numberOfLines={1}>
                {item.pickup}
              </Text>
              <Text style={styles.routeAddress} numberOfLines={1}>
                {item.dropoff}
              </Text>
            </View>
          </View>
        )}

        {hasRoute && !isDone && (
          <Text style={styles.cancelledRouteText} numberOfLines={1}>
            {item.pickup} → {item.dropoff}
          </Text>
        )}
        {!isDone && item.cancelReason && <Text style={styles.cancelledReasonText}>{item.cancelReason}</Text>}

        {isDone && (
          <View style={styles.driverRow}>
            <View style={styles.driverIdentity}>
              <Avatar name={item.driverName || t.history.noDriverAssigned} size="sm" />
              <Text style={styles.driverName}>{item.driverName || t.history.noDriverAssigned}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
          </View>
        )}
      </Card>
    </Pressable>
  );
}

/** Same 1.4s pulse as the finding-driver beacon (motion.duration.pulse) — the redesign's only other continuous animation besides the skeleton one. */
function useSkeletonPulse() {
  const pulse = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: motion.duration.pulse, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: motion.duration.pulse, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return pulse;
}

const SKELETON_ROW_OPACITY = [1, 1, 0.72, 0.45];

function HistorySkeleton() {
  const pulse = useSkeletonPulse();
  return (
    <View style={styles.listContent}>
      <Animated.View style={[styles.skeletonBlock, styles.skeletonMonthLabel, { opacity: pulse }]} />
      {SKELETON_ROW_OPACITY.map((rowOpacity, index) => (
        <Card key={index} variant="raised" style={[styles.rideCard, { opacity: rowOpacity }]}>
          <View style={styles.skeletonRow}>
            <Animated.View style={[styles.skeletonBlock, styles.skeletonAvatar, { opacity: pulse }]} />
            <View style={styles.skeletonTextCol}>
              <Animated.View style={[styles.skeletonBlock, { height: 13, width: '70%', opacity: pulse }]} />
              <Animated.View style={[styles.skeletonBlock, { height: 11, width: '45%', opacity: pulse }]} />
            </View>
            <Animated.View style={[styles.skeletonBlock, { width: 52, height: 16, opacity: pulse }]} />
          </View>
        </Card>
      ))}
    </View>
  );
}

function HistoryEmptyState({ t, onRequestRide }: { t: ReturnType<typeof useTranslation>; onRequestRide: () => void }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyPanel}>
        <BrandMotif size={150} color={colors.accentBlue} opacity={0.05} style={styles.emptyMotif} />
        <View style={styles.emptyIconTile}>
          <Ionicons name="time-outline" size={24} color={colors.accentBlue} />
        </View>
        <Text style={styles.emptyTitle}>{t.history.emptyTitle}</Text>
        <Text style={styles.emptyMessage}>{t.history.emptyMessage}</Text>
        <View style={styles.emptyButton}>
          <Button label={t.history.requestATricycle} tone="success" fullWidth onPress={onRequestRide} />
        </View>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const t = useTranslation();
  const items = useHistoryStore((state) => state.items);
  const loading = useHistoryStore((state) => state.loading);
  const error = useHistoryStore((state) => state.error);
  const load = useHistoryStore((state) => state.load);
  const [filter, setFilter] = useState<FilterMode>('all');

  const { refreshing, onRefresh } = usePullToRefresh(load);

  useFocusEffect(
    useCallback(() => {
      void load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const filteredRides = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((ride) => ride.status === filter);
  }, [items, filter]);

  const monthSummary = useMemo(() => {
    const monthItems = items.filter((item) => isThisMonth(item.date));
    const total = monthItems.filter((item) => item.status === 'done').reduce((sum, item) => sum + item.fare, 0);
    const rideWord = monthItems.length === 1 ? t.history.rideSuffix : t.history.ridesSuffix;
    return `${monthItems.length} ${rideWord} · ${formatCurrency(total)}`;
  }, [items, t]);

  const isInitialLoading = loading && items.length === 0 && !refreshing;

  const filterOptions: { mode: FilterMode; label: string }[] = [
    { mode: 'all', label: t.history.filterAll },
    { mode: 'done', label: t.history.filterCompleted },
    { mode: 'cancelled', label: t.history.filterCancelled },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.heroShadowWrap}>
        <GradientSurface token="hero" direction="diagonal" style={styles.heroPanel}>
          <BrandMotif size={200} color={colors.white} opacity={0.12} style={styles.heroMotif} />
          <SafeAreaView edges={['top']}>
            <Text style={styles.heroEyebrow}>{t.history.eyebrow}</Text>
            <Text style={styles.heroTitle}>{t.history.title}</Text>
            <View style={styles.filterRow}>
              {filterOptions.map(({ mode, label }) => (
                <Pressable
                  key={mode}
                  accessibilityRole="button"
                  onPress={() => setFilter(mode)}
                  style={[styles.filterPill, filter === mode && styles.filterPillActive]}
                >
                  <Text style={[styles.filterPillLabel, filter === mode && styles.filterPillLabelActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </SafeAreaView>
        </GradientSurface>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {isInitialLoading ? (
        <HistorySkeleton />
      ) : (
        <FlatList
          data={filteredRides}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentBluePressed} />
          }
          ListHeaderComponent={
            filteredRides.length > 0 ? (
              <View style={styles.monthRow}>
                <Text style={styles.monthLabel}>{t.history.thisMonth}</Text>
                <Text style={styles.monthSummary}>{monthSummary}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={<HistoryEmptyState t={t} onRequestRide={() => router.push('/booking/request')} />}
          renderItem={({ item }) => (
            <RideCard item={item} t={t} onPress={() => router.push(`/history/${item.id}`)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}
