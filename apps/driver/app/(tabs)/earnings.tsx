import { useEffect } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, Card, EmptyState, MapPlaceholder } from '@trisakay/ui';
import { useEarningsStore } from '../../src/store/useEarningsStore';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/tabs/earnings.styles';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function EarningsScreen() {
  const totalTracked = useEarningsStore((state) => state.totalTracked);
  const loading = useEarningsStore((state) => state.loading);
  const earningsError = useEarningsStore((state) => state.error);
  const load = useEarningsStore((state) => state.load);
  const settlementLog = useEarningsStore((state) => state.settlementLog);
  const notifyPsoForSettlement = useEarningsStore((state) => state.notifyPsoForSettlement);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        <Text style={styles.title}>Earnings</Text>

        <Card style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total earnings (tracked)</Text>
          <Text style={styles.totalValue}>{formatCurrency(totalTracked)}</Text>
        </Card>

        {earningsError && <Text style={styles.error}>{earningsError}</Text>}

        <MapPlaceholder variant="chart" caption="Earnings chart" height={160} />

        <Text style={styles.sectionLabel}>Settlement log (record only)</Text>
        {settlementLog.length === 0 ? (
          <EmptyState title="No settlements logged" message="Notify PSO once you're ready to settle." />
        ) : (
          settlementLog.map((entry) => (
            <View key={entry.id} style={styles.logRow}>
              <View style={styles.logTextSlot}>
                <Text style={styles.logAmount}>{formatCurrency(entry.amount)}</Text>
                <Text style={styles.logDate}>{formatDate(entry.loggedAt)}</Text>
              </View>
              <Badge label="Logged" tone="neutral" />
            </View>
          ))
        )}

        <Button label="Notify PSO for settlement" fullWidth onPress={notifyPsoForSettlement} />
        <Text style={styles.caption}>
          CREATES A RECORD FOR PSO ONLY — NO MONEY MOVES THROUGH THE APP; SETTLEMENT HAPPENS OUTSIDE IT
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
