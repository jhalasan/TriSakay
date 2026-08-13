import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Avatar, Badge, Button, EmptyState, ListRow, Spinner, colors } from '@trisakay/ui';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh';
import { formatCurrency } from '../../src/utils/currency';
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
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export default function HistoryScreen() {
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
        renderItem={({ item }) => (
          <ListRow
            title={item.driverName || 'Driver'}
            // Route is omitted rather than shown half-empty when an endpoint is
            // unknown — "→ SM City" reads as a rendering bug, not as missing data.
            subtitle={
              item.pickup && item.dropoff
                ? `${formatDate(item.date)} · ${item.pickup} → ${item.dropoff}`
                : formatDate(item.date)
            }
            leading={<Avatar name={item.driverName || 'Driver'} size="md" />}
            trailing={
              <View style={styles.trailingSlot}>
                <Badge
                  label={item.status === 'done' ? 'Done' : 'Cancel'}
                  tone={item.status === 'done' ? 'green' : 'danger'}
                />
                <Text style={styles.fareText}>{formatCurrency(item.fare)}</Text>
              </View>
            }
          />
        )}
      />
    </SafeAreaView>
  );
}
