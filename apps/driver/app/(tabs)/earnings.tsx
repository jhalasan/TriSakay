import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, EmptyState, MapPlaceholder } from '@trisakay/ui';
import { useEarningsStore } from '../../src/store/useEarningsStore';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/tabs/earnings.styles';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function EarningsScreen() {
  const totalTracked = useEarningsStore((state) => state.totalTracked);
  const settlementLog = useEarningsStore((state) => state.settlementLog);
  const notifyPsoForSettlement = useEarningsStore((state) => state.notifyPsoForSettlement);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Earnings</Text>

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total earnings (tracked)</Text>
          <Text style={styles.totalValue}>{formatCurrency(totalTracked)}</Text>
        </View>

        <MapPlaceholder variant="chart" caption="Earnings chart" height={160} />

        <Text style={styles.sectionLabel}>Settlement log (record only)</Text>
        {settlementLog.length === 0 ? (
          <EmptyState title="No settlements logged" message="Notify PSO once you're ready to settle." />
        ) : (
          settlementLog.map((entry) => (
            <View key={entry.id} style={styles.logRow}>
              <Text style={styles.logAmount}>{formatCurrency(entry.amount)}</Text>
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
