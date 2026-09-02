import { useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { RefreshControl, SectionList, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Card, EmptyState, Spinner, colors } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { useTranslation } from '../../src/hooks/useTranslation';
import { formatCurrency } from '../../src/utils/currency';
import type { RideHistoryItem } from '../../src/types/ride';
import { styles } from '../../src/styles/profile/payment-history.styles';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function monthLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}

export default function PaymentHistoryScreen() {
  const t = useTranslation();
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

  const sections = useMemo(() => {
    const grouped: { title: string; total: number; data: RideHistoryItem[] }[] = [];
    for (const item of payments) {
      const label = monthLabel(item.date);
      const lastGroup = grouped[grouped.length - 1];
      const paidAmount = item.paymentStatus === 'paid' ? item.fare : 0;
      if (lastGroup && lastGroup.title === label) {
        lastGroup.data.push(item);
        lastGroup.total += paidAmount;
      } else {
        grouped.push({ title: label, total: paidAmount, data: [item] });
      }
    }
    return grouped;
  }, [payments]);

  if (loading && items.length === 0 && !refreshing) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t.accountPages.paymentHistoryTitle} />
        <View style={styles.loadingWrap}>
          <Spinner size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={t.accountPages.paymentHistoryTitle} />
      {error && <Text style={styles.errorText}>{error}</Text>}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentBluePressed} />
        }
        ListEmptyComponent={
          <EmptyState title={t.accountPages.noPaymentsYetTitle} message={t.accountPages.noPaymentsYetMessage} />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.monthRow}>
            <Text style={styles.monthLabel}>{section.title}</Text>
            <Text style={styles.monthTotal}>
              {formatCurrency(section.total)} {t.accountPages.paidSuffix}
            </Text>
          </View>
        )}
        renderItem={({ item }) => {
          const isGcash = item.paymentMethod === 'gcash';
          return (
            <Card style={styles.rowCard}>
              <View style={[styles.iconTile, { backgroundColor: isGcash ? colors.accentBlueSoft : colors.accentGreenSoft }]}>
                <Ionicons
                  name={isGcash ? 'card-outline' : 'cash-outline'}
                  size={18}
                  color={isGcash ? colors.accentBluePressed : colors.accentGreenPressed}
                />
              </View>
              <View style={styles.textSlot}>
                <Text style={styles.routeText} numberOfLines={1}>
                  {item.pickup && item.dropoff ? `${item.pickup} → ${item.dropoff}` : 'Trip'}
                </Text>
                <Text style={styles.dateMethodText}>
                  {formatDate(item.date)} · {isGcash ? 'GCash' : 'Cash'}
                </Text>
              </View>
              <View style={styles.trailingSlot}>
                <Text style={styles.fareText}>{formatCurrency(item.fare)}</Text>
                <Text style={[styles.statusText, item.paymentStatus === 'refunded' && styles.statusTextRefunded]}>
                  {item.paymentStatus === 'paid' ? t.accountPages.statusPaid : t.accountPages.statusRefunded}
                </Text>
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}
