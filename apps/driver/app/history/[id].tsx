import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, EmptyState, IconTile, NavyBandHeader, RouteRail, StatCells, StatusPill, colors } from '@trisakay/ui';
import { formatClockTime, formatDetailDate, minutesBefore } from '@trisakay/shared';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { useTranslation } from '../../src/hooks/useTranslation';
import { formatCurrency } from '../../src/utils/currency';
import { getReferenceCode } from '../../src/utils/reference';
import { styles } from '../../src/styles/history/detail.styles';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const h = t.driver.history;
  const item = useHistoryStore((state) => state.trips.find((trip) => trip.id === id));

  if (!item) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={h.detailTitle} />
        <EmptyState title={h.notFoundTitle} message={h.notFoundMessage} />
      </View>
    );
  }

  const isDone = item.status === 'done';
  const hasRoute = !!item.pickup && !!item.dropoff;
  const reference = getReferenceCode(item.id);
  const passengerName = item.passengerName || h.passengerFallback;

  // `item.date` is the trip's end, so the pickup time is that minus the
  // duration; both times are hidden when the duration is unknown.
  const hasTimes = isDone && item.durationMinutes != null;
  const dropoffTime = hasTimes ? formatClockTime(item.date) : undefined;
  const pickupTime = hasTimes ? formatClockTime(minutesBefore(item.date, item.durationMinutes!)) : undefined;

  const statCells = isDone
    ? [
        ...(item.distanceKm != null ? [{ value: `${item.distanceKm.toFixed(1)} km`, caption: h.distance }] : []),
        ...(item.durationMinutes != null ? [{ value: `${Math.round(item.durationMinutes)} ${h.minutesSuffix}`, caption: h.duration }] : []),
      ]
    : [];

  const seatChip =
    item.seats != null ? (
      <View style={styles.seatChip}>
        <Ionicons name="person" size={13} color={colors.ink} />
        <Text style={styles.seatChipText}>{`${item.seats} ${item.seats === 1 ? h.seatSingular : h.seatPlural}`}</Text>
      </View>
    ) : null;

  const passengerRow = (
    <View style={styles.passengerRow}>
      <Avatar name={item.passengerName ?? undefined} source={item.passengerAvatarUrl ? { uri: item.passengerAvatarUrl } : undefined} size="md" />
      <View style={styles.passengerBody}>
        <Text style={styles.passengerLabel}>{h.passenger}</Text>
        <Text style={styles.passengerName} numberOfLines={1}>
          {passengerName}
        </Text>
      </View>
      {seatChip}
    </View>
  );

  const paymentName = item.paymentMethod === 'gcash' ? t.common.gcash : item.paymentMethod === 'cash' ? t.common.cash : null;
  const paymentTone = item.paymentStatus === 'paid' ? 'green' : item.paymentStatus === 'failed' ? 'red' : 'navy';
  const paymentLabel =
    item.paymentStatus === 'paid'
      ? h.paidStatus
      : item.paymentStatus
        ? item.paymentStatus.charAt(0).toUpperCase() + item.paymentStatus.slice(1)
        : null;

  // Deep-links into the existing complaints screen, which already reads `rideRequestId`.
  function handleReport() {
    router.push({ pathname: '/complaints', params: { rideRequestId: item!.id } });
  }

  const reportRow = (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" onPress={handleReport} style={styles.reportRow}>
        <IconTile icon="flag" tone="red" size={34} />
        <View style={styles.listBody}>
          <Text style={styles.reportTitle}>{h.reportProblem}</Text>
          <Text style={styles.reportHint}>{h.reportProblemHint}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.inkSoft} />
      </Pressable>
    </View>
  );

  const referenceLine = reference ? (
    <View style={styles.refRow}>
      <Text style={styles.refLabel}>{h.tripReferenceFull}</Text>
      <Text style={styles.refValue}>#{reference}</Text>
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <NavyBandHeader
          title={h.detailTitle}
          onBack={() => router.back()}
          backAccessibilityLabel={t.common.goBackA11y}
          topInset={insets.top}
          overlapBottom
          right={<StatusPill label={isDone ? h.done : h.filterCancelled} tone={isDone ? 'green' : 'red'} />}
        >
          <View style={styles.hero}>
            {isDone ? (
              <>
                <Text style={styles.heroEyebrow}>{h.youEarned}</Text>
                <Text style={styles.heroAmount}>{item.fare !== null ? formatCurrency(item.fare) : '—'}</Text>
                <View style={styles.heroMetaRow}>
                  {paymentName && (
                    <View style={styles.heroMetaItem}>
                      <Ionicons name={item.paymentMethod === 'gcash' ? 'wallet-outline' : 'cash-outline'} size={15} color={colors.white} />
                      <Text style={styles.heroMeta}>{item.paymentMethod === 'gcash' ? h.gcashReceived : h.cashCollected}</Text>
                    </View>
                  )}
                  {paymentName && <View style={styles.heroDot} />}
                  <Text style={styles.heroMetaDate}>{`${formatDetailDate(item.date, false)} · ${formatClockTime(item.date)}`}</Text>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.heroDate}>{`${formatDetailDate(item.date)} · ${formatClockTime(item.date)}`}</Text>
                <Text style={styles.heroCancelled}>{h.tripCancelledTitle}</Text>
                <Text style={styles.heroSub}>{h.noEarningsNote}</Text>
              </>
            )}
          </View>
        </NavyBandHeader>

        <View style={styles.body}>
          {isDone ? (
            <View style={[styles.overlapSlot, styles.heroShadow]}>
              <View style={styles.cardHero}>
                {passengerRow}
                {hasRoute && (
                  <View style={styles.routePad}>
                    <RouteRail
                      pickup={{ name: item.pickup!, label: h.pickedUp, time: pickupTime }}
                      dropoff={{ name: item.dropoff!, label: h.droppedOff, time: dropoffTime }}
                    />
                  </View>
                )}
                {statCells.length > 0 && <StatCells cells={statCells} />}
              </View>
            </View>
          ) : (
            <>
              <View style={[styles.overlapSlot, styles.heroShadow]}>
                <View style={[styles.cardHero, styles.reasonCard]}>
                  <IconTile icon="information-circle" tone="red" size={38} />
                  <View style={styles.reasonText}>
                    <Text style={styles.reasonEyebrow}>{h.whyCancelled}</Text>
                    <Text style={styles.reasonValue}>{item.cancelReason || h.noReasonGiven}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.card}>
                {passengerRow}
                {hasRoute && (
                  <View style={styles.routePad}>
                    <RouteRail pickup={{ name: item.pickup!, label: h.pickup }} dropoff={{ name: item.dropoff!, label: h.dropoff }} />
                  </View>
                )}
              </View>
            </>
          )}

          {isDone && (
            <View style={[styles.card, styles.listCard]}>
              {paymentName && (
                <View style={styles.listRow}>
                  <IconTile icon={item.paymentMethod === 'gcash' ? 'wallet' : 'cash'} tone="green" size={34} />
                  <View style={styles.listBody}>
                    <Text style={styles.listTitle}>{paymentName}</Text>
                    <Text style={styles.listSub}>{h.paymentMethod}</Text>
                  </View>
                  {paymentLabel && <StatusPill label={paymentLabel} tone={paymentTone} />}
                </View>
              )}
              {reference && (
                <View style={[styles.listRow, paymentName ? styles.listRowDivider : null]}>
                  <IconTile icon="keypad" tone="neutral" size={34} />
                  <View style={styles.listBody}>
                    <Text style={styles.listTitleMono}>{reference}</Text>
                    <Text style={styles.listSub}>{h.tripReferenceFull}</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {!isDone && referenceLine}
          {reportRow}
        </View>
      </ScrollView>
    </View>
  );
}
