import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, EmptyState, ListRow } from '@trisakay/ui';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/tabs/history.styles';

type FilterMode = 'all' | 'done' | 'cancelled';

const FILTER_LABEL: Record<FilterMode, string> = { all: 'Filter', done: 'Done', cancelled: 'Cancelled' };
const NEXT_FILTER: Record<FilterMode, FilterMode> = { all: 'done', done: 'cancelled', cancelled: 'all' };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export default function HistoryScreen() {
  const trips = useHistoryStore((state) => state.trips);
  const loading = useHistoryStore((state) => state.loading);
  const historyError = useHistoryStore((state) => state.error);
  const load = useHistoryStore((state) => state.load);
  const [filter, setFilter] = useState<FilterMode>('all');

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
        <Text style={styles.title}>Trip history</Text>
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
          loading ? null : <EmptyState title="No trips yet" message="Your completed trips will show up here." />
        }
        renderItem={({ item }) => (
          <ListRow
            title={item.passengerName || 'Passenger'}
            subtitle={formatDate(item.date)}
            leading={<Avatar name={item.passengerName ?? undefined} size="md" />}
            trailing={
              <View style={styles.trailingSlot}>
                <Badge label={item.status === 'done' ? 'Done' : 'Cancel'} tone={item.status === 'done' ? 'green' : 'danger'} />
                <Text style={styles.fareText}>{item.fare !== null ? formatCurrency(item.fare) : '—'}</Text>
              </View>
            }
          />
        )}
      />
    </SafeAreaView>
  );
}
