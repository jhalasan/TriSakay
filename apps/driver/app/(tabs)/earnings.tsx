import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, BrandMotif, Button, EmptyState, GradientSurface, colors } from '@trisakay/ui';
import { EarningsBarChart } from '../../src/components/EarningsBarChart';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useEarningsStore } from '../../src/store/useEarningsStore';
import { formatCurrency } from '../../src/utils/currency';
import { interpolate } from '../../src/utils/interpolate';
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

  // Both derived from the same all-time breakdown the chart already has — no extra fetch.
  const totalTrips = dailyBreakdown.reduce((sum, day) => sum + day.ridesCompleted, 0);
  const averageFare = totalTrips > 0 ? totalTracked / totalTrips : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        <Text style={styles.title}>{t.driver.earnings.title}</Text>

        <View style={styles.totalCardShadow}>
          <GradientSurface token="hero" direction="diagonal" texture textureOpacity={0.05} style={styles.totalCard}>
            <BrandMotif size={200} color={colors.white} opacity={0.12} style={styles.totalMotif} />
            <Text style={styles.totalLabel}>{t.driver.earnings.totalTracked}</Text>
            <Text style={styles.totalValue}>{formatCurrency(totalTracked)}</Text>
            {totalTrips > 0 && (
              <View style={styles.totalStatsRow}>
                <View style={styles.totalStat}>
                  <Ionicons name="navigate" size={15} color={colors.white} />
                  <Text style={styles.totalStatText}>{interpolate(t.driver.earnings.tripsCount, { count: totalTrips })}</Text>
                </View>
                <View style={styles.totalStat}>
                  <Ionicons name="cash-outline" size={15} color={colors.accentGreenSoft} />
                  <Text style={styles.totalStatText}>{interpolate(t.driver.earnings.averageFare, { amount: formatCurrency(averageFare) })}</Text>
                </View>
              </View>
            )}
          </GradientSurface>
        </View>

        {earningsError && <Text style={styles.error}>{earningsError}</Text>}

        <Text style={styles.sectionLabel}>{t.driver.earnings.last7Days}</Text>
        {dailyBreakdown.length === 0 ? (
          <EmptyState title={t.driver.earnings.noEarningsTitle} message={t.driver.earnings.noEarningsMessage} />
        ) : (
          <View style={styles.chartPanel}>
            <EarningsBarChart data={dailyBreakdown} height={150} todayLabel={t.driver.earnings.today} />
          </View>
        )}

        <Text style={styles.sectionLabel}>{t.driver.earnings.settlementLog}</Text>
        {settlementLog.length === 0 ? (
          <EmptyState title={t.driver.earnings.noSettlementsTitle} message={t.driver.earnings.noSettlementsMessage} />
        ) : (
          <View style={styles.logPanel}>
            {settlementLog.map((entry, index) => (
              <View key={entry.id} style={[styles.logRow, index === settlementLog.length - 1 && styles.logRowLast]}>
                <View style={styles.logTextSlot}>
                  <Text style={styles.logAmount}>{formatCurrency(entry.amount)}</Text>
                  <Text style={styles.logDate}>{formatDate(entry.loggedAt)}</Text>
                </View>
                <Badge label={t.driver.earnings.logged} tone="neutral" />
              </View>
            ))}
          </View>
        )}

        <Button label={t.driver.earnings.notifyPso} fullWidth onPress={notifyPsoForSettlement} />
        <Text style={styles.caption}>{t.driver.earnings.caption}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
