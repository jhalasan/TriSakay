import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMotif, Button, colors, EmptyState, GradientSurface, RequestCard } from '@trisakay/ui';
import { useAcceptRideRequest } from '../../src/hooks/useAcceptRideRequest';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useDriverStore } from '../../src/store/useDriverStore';
import { useRequestsStore } from '../../src/store/useRequestsStore';
import { useRequestsTutorialDemo } from '../../src/hooks/useTutorialDemoState';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/tabs/requests.styles';

export default function RequestsScreen() {
  const router = useRouter();
  const t = useTranslation();
  const user = useAuthStore((state) => state.user);
  const tutorialDemo = useRequestsTutorialDemo();
  const isAvailableReal = useDriverStore((state) => state.isAvailable);
  const isAvailable = tutorialDemo.active ? true : isAvailableReal;
  const pendingReal = useRequestsStore((state) => state.pending);
  const pending = tutorialDemo.active ? tutorialDemo.data.pending : pendingReal;
  const requestError = useRequestsStore((state) => state.error);
  const decline = useRequestsStore((state) => state.decline);
  const { acceptRideRequest, acceptingId } = useAcceptRideRequest();

  const availableNowSummary = useMemo(() => {
    const total = pending.reduce((sum, item) => sum + (item.fare ?? 0), 0);
    const requestWord = pending.length === 1 ? t.driver.requests.requestSuffix : t.driver.requests.requestsSuffix;
    return `${pending.length} ${requestWord} · ${formatCurrency(total)}`;
  }, [pending, t]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.heroShadow}>
        <GradientSurface token="hero" direction="diagonal" style={styles.heroBand}>
          <BrandMotif size={200} color={colors.white} opacity={0.12} style={styles.motif} />
          <Text style={styles.heroEyebrow}>{t.driver.requests.eyebrow}</Text>
          <Text style={styles.heroTitle}>{t.driver.requests.title}</Text>

          {/* P1-20 (2026-09-15 launch audit): the along-route/nearby/all filter
              pills that used to sit here were decorative — matchFilter was set
              by them and read by nothing else; the list was always the full
              unfiltered `pending` set. Removed rather than shipped fake, per
              docs/RIDE_REQUEST_FLOW_AUDIT.MD's own note that per-request
              distance is the only signal currently available (no per-request
              "along route" classification exists to filter by). The offline
              indicator below is a real state, not a filter, and stays. */}
          {!isAvailable && (
            <View style={styles.filterRow}>
              <View style={[styles.filterPill, styles.filterPillActive, styles.offlinePill]}>
                <View style={styles.offlineDot} />
                <Text style={[styles.filterPillLabel, styles.filterPillLabelActive]}>{t.driver.requests.offline.toUpperCase()}</Text>
              </View>
            </View>
          )}
        </GradientSurface>
      </View>

      {requestError && <Text style={styles.error}>{requestError}</Text>}

      <FlatList
        data={pending}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          isAvailable && pending.length > 0 ? (
            <View style={styles.availableRow}>
              <Text style={styles.availableLabel}>{t.driver.requests.availableNow}</Text>
              <Text style={styles.availableSummary}>{availableNowSummary}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          isAvailable ? (
            <EmptyState title={t.driver.requests.noRequestsTitle} message={t.driver.requests.noRequestsMessage} />
          ) : (
            <EmptyState
              icon={
                <View style={styles.offlineIconTile}>
                  <Ionicons name="list-outline" size={32} color={colors.lineStrong} />
                </View>
              }
              title={t.driver.requests.offlineTitle}
              message={t.driver.requests.offlineMessage}
              action={
                <Button
                  label={t.driver.requests.goToDashboard}
                  icon={<Ionicons name="arrow-forward" size={16} color={colors.white} />}
                  onPress={() => router.push('/(tabs)/dashboard')}
                />
              }
            />
          )
        }
        renderItem={({ item }) => (
          <RequestCard
            request={item}
            variant="incoming"
            accepting={acceptingId === item.id}
            onAccept={() => (tutorialDemo.active ? undefined : acceptRideRequest(item.id))}
            onDecline={() => (tutorialDemo.active ? undefined : user && decline(item.id, user.id))}
            copy={{
              decline: t.driver.requestCard.decline,
              accept: t.driver.requestCard.accept,
              newRideRequest: t.driver.requestCard.newRideRequest,
              seatsSingular: t.driver.requestCard.seatsSingular,
              seatsPlural: t.driver.requestCard.seatsPlural,
              pickupLabel: t.driver.requestCard.pickupLabel,
              dropoffLabel: t.driver.requestCard.dropoffLabel,
              pickupAwaySuffix: t.driver.requestCard.pickupAwaySuffix,
              paymentMethodCash: t.driver.requestCard.paymentMethodCash,
              paymentMethodGcash: t.driver.requestCard.paymentMethodGcash,
            }}
          />
        )}
      />
    </SafeAreaView>
  );
}
