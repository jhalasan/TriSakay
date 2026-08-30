import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Badge, Button, Card, EmptyState, Spinner, colors } from '@trisakay/ui';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh';
import { formatCurrency } from '../../src/utils/currency';
import type { RideHistoryItem } from '../../src/types/ride';
import { styles } from '../../src/styles/tabs/history.styles';

type FilterMode = 'all' | 'done' | 'cancelled';

const FILTER_LABEL: Record<FilterMode, string> = {
  all: 'Filter',
  done: 'Done',
  cancelled: 'Cancelled',
};

const NEXT_FILTER: Record<FilterMode, FilterMode> = {
  all: 'done',
  done: 'cancelled',
  cancelled: 'all',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

function RideCard({ item, onPress }: { item: RideHistoryItem; onPress: () => void }) {
  const hasRoute = item.pickup && item.dropoff;

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card variant="raised" style={styles.rideCard}>
        <View style={styles.cardTopRow}>
          <View style={styles.dateTimeRow}>
            <Ionicons name="time-outline" size={14} color={colors.inkFaint} />
            <Text style={styles.dateTimeText}>
              {formatDate(item.date)} · {formatTime(item.date)}
            </Text>
          </View>
          <View style={styles.topRowTrailing}>
            <Badge
              label={item.status === 'done' ? 'Completed' : 'Cancelled'}
              tone={item.status === 'done' ? 'green' : 'danger'}
            />
            <Text style={styles.fareText}>{formatCurrency(item.fare)}</Text>
          </View>
        </View>

        {hasRoute && (
          <View style={styles.routeBlock}>
            <View style={styles.routeRow}>
              <View style={styles.routeMarkerCol}>
                <View style={[styles.routeDot, styles.routeDotPickup]} />
                <View style={styles.routeLine} />
              </View>
              <View style={styles.routeTextCol}>
                <Text style={styles.routeLabel}>Pickup</Text>
                <Text style={styles.routeAddress} numberOfLines={1}>
                  {item.pickup}
                </Text>
              </View>
            </View>
            <View style={styles.routeRow}>
              <View style={styles.routeMarkerCol}>
                <View style={[styles.routeDot, styles.routeDotDropoff]} />
              </View>
              <View style={styles.routeTextCol}>
                <Text style={styles.routeLabel}>Dropoff</Text>
                <Text style={styles.routeAddress} numberOfLines={1}>
                  {item.dropoff}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.driverRow}>
          <Avatar name={item.driverName || 'Driver'} size="sm" />
          <Text style={styles.driverName}>{item.driverName || 'Driver'}</Text>
        </View>
      </Card>
    </Pressable>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
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

  if (loading && items.length === 0 && !refreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingWrap}>
          <Spinner size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Ride history</Text>
        <Button
          label={FILTER_LABEL[filter]}
          size="sm"
          variant="outline"
          tone="neutral"
          onPress={() => setFilter((current) => NEXT_FILTER[current])}
        />
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <FlatList
        data={filteredRides}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentBluePressed} />
        }
        ListEmptyComponent={<EmptyState title="No rides yet" message="Your completed trips will show up here." />}
        renderItem={({ item }) => <RideCard item={item} onPress={() => router.push(`/history/${item.id}`)} />}
      />
    </SafeAreaView>
  );
}
