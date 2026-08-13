import { useCallback, useMemo } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Badge, EmptyState, ListRow, Spinner, colors } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/profile/payment-history.styles';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export default function PaymentHistoryScreen() {
  const items = useHistoryStore((state) => state.items);
  const loading = useHistoryStore((state) => state.loading);
  const error = useHistoryStore((state) => state.error);
  const load = useHistoryStore((state) => state.load);

  const { refreshing, onRefresh } = usePullToRefresh(load);

  useFocusEffect(
    useCallback(() => {
      void load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // A pending/failed/absent payment means checkout never actually resolved —
  // it doesn't belong in a "history" list, only paid/refunded do.
  const payments = useMemo(
    () => items.filter((item) => item.paymentStatus === 'paid' || item.paymentStatus === 'refunded'),
    [items]
  );

  if (loading && items.length === 0 && !refreshing) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Payment history" />
        <View style={styles.loadingWrap}>
          <Spinner size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Payment history" />
      {error && <Text style={styles.errorText}>{error}</Text>}
      <FlatList
        data={payments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentBluePressed} />
        }
        ListEmptyComponent={<EmptyState title="No payments yet" message="Your paid trips will show up here." />}
        renderItem={({ item }) => (
          <ListRow
            title={
              item.pickup && item.dropoff ? `${item.pickup} → ${item.dropoff}` : 'Trip'
            }
            subtitle={formatDate(item.date)}
            trailing={
              <View style={styles.trailingSlot}>
                <Badge
                  label={item.paymentMethod === 'gcash' ? 'GCash' : item.paymentMethod === 'cash' ? 'Cash' : '—'}
                  tone="neutral"
                />
                <Badge
                  label={item.paymentStatus === 'paid' ? 'Paid' : 'Refunded'}
                  tone={item.paymentStatus === 'paid' ? 'green' : 'blue'}
                />
                <Text style={styles.fareText}>{formatCurrency(item.fare)}</Text>
              </View>
            }
          />
        )}
      />
    </View>
  );
}
