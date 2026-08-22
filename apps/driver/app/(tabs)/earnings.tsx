import { useEffect } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, Card, EmptyState } from '@trisakay/ui';
import { EarningsBarChart } from '../../src/components/EarningsBarChart';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useEarningsStore } from '../../src/store/useEarningsStore';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/tabs/earnings.styles';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function EarningsScreen() {
  const t = useTranslation();
  const totalTracked = useEarningsStore((state) => state.totalTracked);
  const dailyBreakdown = useEarningsStore((state) => state.dailyBreakdown);
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
        <Text style={styles.title}>{t.driver.earnings.title}</Text>

        <Card style={styles.totalCard}>
          <Text style={styles.totalLabel}>{t.driver.earnings.totalTracked}</Text>
          <Text style={styles.totalValue}>{formatCurrency(totalTracked)}</Text>
        </Card>

        {earningsError && <Text style={styles.error}>{earningsError}</Text>}

        <Text style={styles.sectionLabel}>{t.driver.earnings.last7Days}</Text>
        {dailyBreakdown.length === 0 ? (
          <EmptyState title={t.driver.earnings.noEarningsTitle} message={t.driver.earnings.noEarningsMessage} />
        ) : (
          <EarningsBarChart data={dailyBreakdown} height={160} />
        )}

        <Text style={styles.sectionLabel}>{t.driver.earnings.settlementLog}</Text>
        {settlementLog.length === 0 ? (
          <EmptyState title={t.driver.earnings.noSettlementsTitle} message={t.driver.earnings.noSettlementsMessage} />
        ) : (
          settlementLog.map((entry) => (
            <View key={entry.id} style={styles.logRow}>
              <View style={styles.logTextSlot}>
                <Text style={styles.logAmount}>{formatCurrency(entry.amount)}</Text>
                <Text style={styles.logDate}>{formatDate(entry.loggedAt)}</Text>
              </View>
              <Badge label={t.driver.earnings.logged} tone="neutral" />
            </View>
          ))
        )}

        <Button label={t.driver.earnings.notifyPso} fullWidth onPress={notifyPsoForSettlement} />
        <Text style={styles.caption}>{t.driver.earnings.caption}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
