import { useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, EmptyState, ListRow } from '@trisakay/ui';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from './history.styles';

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
  const rides = useHistoryStore((state) => state.rides);
  const [filter, setFilter] = useState<FilterMode>('all');

  const filteredRides = useMemo(() => {
    if (filter === 'all') return rides;
    return rides.filter((ride) => ride.status === filter);
  }, [rides, filter]);

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

      <FlatList
        data={filteredRides}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyState title="No rides yet" message="Your completed trips will show up here." />}
        renderItem={({ item }) => (
          <ListRow
            title={item.driverName}
            subtitle={`${formatDate(item.date)} · ${item.pickup} → ${item.dropoff}`}
            leading={<Avatar name={item.driverName} size="md" />}
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
