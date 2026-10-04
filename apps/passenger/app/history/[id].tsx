import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  EmptyState,
  GradientSurface,
  IconTile,
  NavyBandHeader,
  RouteRail,
  StatCells,
  StatusPill,
  colors, ADAPTIVE_LABEL_PROPS } from '@trisakay/ui';
import { formatClockTime, formatDetailDate, minutesBefore } from '@trisakay/shared';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { EmailReceiptButton } from '../../src/components/EmailReceiptButton';
import { useTranslation } from '../../src/hooks/useTranslation';
import { formatCurrency } from '../../src/utils/currency';
import { getReferenceCode } from '../../src/utils/reference';
import { styles } from '../../src/styles/history/detail.styles';

export default function RideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const item = useHistoryStore((state) => state.items.find((ride) => ride.id === id));
  const [copied, setCopied] = useState(false);

  if (!item) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t.history.detailTitle} />
        <EmptyState title={t.history.notFoundTitle} message={t.history.notFoundMessage} />
      </View>
    );
  }

  const isDone = item.status === 'done';
  const hasRoute = !!item.pickup && !!item.dropoff;
  const reference = getReferenceCode(item.id);
  // `item.fare` is already the discounted total the passenger paid — the
  // pre-discount base fare isn't stored separately, so it's backed out from
  // the percent that is.
  const showFareBreakdown = item.discountApplied && item.discountPercent != null && item.discountPercent > 0;
  const baseFare = showFareBreakdown ? item.fare / (1 - item.discountPercent! / 100) : null;
  const discountAmount = baseFare != null ? baseFare - item.fare : null;

  // `item.date` is the ride's end (completed_at), so the pickup time is that
  // minus the trip duration. Both times are hidden when the duration is unknown.
  const hasTimes = isDone && item.durationMinutes != null;
  const dropoffTime = hasTimes ? formatClockTime(item.date) : undefined;
  const pickupTime = hasTimes ? formatClockTime(minutesBefore(item.date, item.durationMinutes!)) : undefined;

  const seatCaption = item.seats === 1 ? t.history.seatSingular : t.history.seatPlural;
  const statCells = isDone
    ? [
        ...(item.distanceKm != null ? [{ value: `${item.distanceKm.toFixed(1)} km`, caption: t.history.distance }] : []),
        ...(item.durationMinutes != null
          ? [{ value: `${Math.round(item.durationMinutes)} ${t.history.minutesSuffix}`, caption: t.history.duration }]
          : []),
        ...(item.seats != null ? [{ value: String(item.seats), caption: seatCaption }] : []),
      ]
    : [
        ...(item.distanceKm != null ? [{ value: `${item.distanceKm.toFixed(1)} km`, caption: t.history.plannedDistance }] : []),
        ...(item.seats != null ? [{ value: String(item.seats), caption: seatCaption }] : []),
      ];

  const paymentName =
    item.paymentMethod === 'gcash' ? t.common.gcash : item.paymentMethod === 'cash' ? t.common.cash : t.history.noPaymentMethod;
  const paymentTone = item.paymentStatus === 'paid' ? 'green' : item.paymentStatus === 'failed' ? 'red' : 'navy';
  const paymentLabel =
    item.paymentStatus === 'paid'
      ? t.history.paidStatus
      : item.paymentStatus
        ? item.paymentStatus.charAt(0).toUpperCase() + item.paymentStatus.slice(1)
        : null;

  async function handleCopy() {
    if (!reference) return;
    await Clipboard.setStringAsync('#' + reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleGetHelp() {
    router.push({ pathname: '/complaints/new', params: { rideRequestId: item!.id } });
  }

  // D5: the history RPC returns place labels but no coordinates, so the route
  // can't be prefilled yet — this starts a fresh booking. Extending the RPC
  // with pickup/destination lat/lng is the smallest change that fixes it.
  function handleBookAgain() {
    router.push('/booking/request');
  }

  const referenceRow = reference ? (
    <View style={styles.refRow}>
      <Text style={styles.refLabel}>
        {t.history.tripReferenceFull} <Text style={styles.refValue}>#{reference}</Text>
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.history.copyReference}
        hitSlop={8}
        onPress={handleCopy}
        style={styles.copyLink}
      >
        <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={colors.accentBlue} />
        <Text {...ADAPTIVE_LABEL_PROPS} style={styles.copyText}>{copied ? t.history.copiedReference : t.history.copyReference}</Text>
      </Pressable>
    </View>
  ) : null;

  const driverBlock = item.driverName ? (
    isDone ? (
      <View style={styles.card}>
        <View style={styles.driverRow}>
          <Avatar name={item.driverName} source={item.driverAvatarUrl ? { uri: item.driverAvatarUrl } : undefined} size="md" />
          <View style={styles.driverBody}>
            <View style={styles.driverNameRow}>
              <Text style={styles.driverName} numberOfLines={1}>
                {item.driverName}
              </Text>
              {item.driverRating != null && item.driverRating > 0 && (
                <>
                  <Ionicons name="star" size={13} color={colors.accentGreen} />
                  <Text style={styles.ratingText}>{item.driverRating.toFixed(1)}</Text>
                </>
              )}
            </View>
            {(item.bodyNo || item.plateNo) && (
              <View style={styles.tagRow}>
                <Ionicons name="shield-checkmark" size={14} color={colors.accentGreen} />
                {item.bodyNo ? (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{`${t.history.bodyNoPrefix} ${item.bodyNo}`.toUpperCase()}</Text>
                  </View>
                ) : null}
                {item.plateNo ? (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{item.plateNo}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        </View>
      </View>
    ) : (
      <View style={styles.card}>
        <View style={styles.driverRowCompact}>
          <Avatar name={item.driverName} source={item.driverAvatarUrl ? { uri: item.driverAvatarUrl } : undefined} size="md" />
          <View style={styles.driverBody}>
            <Text style={styles.driverNameCompact} numberOfLines={1}>
              {item.driverName}
            </Text>
            <Text style={styles.driverSub} numberOfLines={1}>
              {[t.history.assignedDriver, item.bodyNo && `${t.history.bodyNoPrefix} ${item.bodyNo}`].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
      </View>
    )
  ) : null;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <NavyBandHeader
          title={t.history.detailTitle}
          onBack={() => router.back()}
          backAccessibilityLabel={t.common.goBackA11y}
          topInset={insets.top}
          overlapBottom
          right={<StatusPill label={isDone ? t.history.completed : t.history.cancelled} tone={isDone ? 'green' : 'red'} />}
        >
          <View style={styles.hero}>
            <Text style={styles.heroDate}>{`${formatDetailDate(item.date)} · ${formatClockTime(item.date)}`}</Text>
            {isDone ? (
              <>
                <Text style={styles.heroFare}>{formatCurrency(item.fare)}</Text>
                <View style={styles.heroMetaRow}>
                  {item.paymentMethod && (
                    <View style={styles.heroMetaItem}>
                      <Ionicons
                        name={item.paymentMethod === 'gcash' ? 'wallet-outline' : 'cash-outline'}
                        size={15}
                        color={colors.white}
                      />
                      <Text style={styles.heroMeta}>
                        {item.paymentMethod === 'gcash' ? t.history.paidWithGcash : t.history.paidInCash}
                      </Text>
                    </View>
                  )}
                  {item.discountApplied && (
                    <>
                      {item.paymentMethod && <View style={styles.heroDot} />}
                      <Text style={styles.heroDiscount}>
                        {item.discountPercent != null
                          ? `${item.discountPercent}${t.history.discountAppliedSuffix}`
                          : t.history.discountAppliedGeneric}
                      </Text>
                    </>
                  )}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.heroCancelled}>{t.history.rideCancelledTitle}</Text>
                <Text style={styles.heroSub}>{t.history.notChargedNote}</Text>
              </>
            )}
          </View>
        </NavyBandHeader>

        <View style={styles.body}>
          {isDone ? (
            <View style={[styles.overlapSlot, styles.heroShadow]}>
              <View style={styles.cardHero}>
                {hasRoute && (
                  <View style={styles.routePad}>
                    <RouteRail
                      pickup={{ name: item.pickup, label: t.history.pickup, time: pickupTime }}
                      dropoff={{ name: item.dropoff, label: t.history.dropoff, time: dropoffTime }}
                    />
                  </View>
                )}
                {statCells.length > 0 && <StatCells cells={statCells} />}
              </View>
            </View>
          ) : (
            <View style={[styles.overlapSlot, styles.heroShadow]}>
              <View style={[styles.cardHero, styles.reasonCard]}>
                <IconTile icon="information-circle" tone="red" size={38} />
                <View style={styles.reasonText}>
                  <Text style={styles.reasonEyebrow}>{t.history.whyCancelled}</Text>
                  <Text style={styles.reasonValue}>{item.cancelReason || t.history.noReasonGiven}</Text>
                </View>
              </View>
            </View>
          )}

          {!isDone && hasRoute && (
            <View style={styles.card}>
              <View style={styles.routePad}>
                <RouteRail pickup={{ name: item.pickup, label: t.history.pickup }} dropoff={{ name: item.dropoff, label: t.history.dropoff }} />
              </View>
              {statCells.length > 0 && <StatCells cells={statCells} />}
            </View>
          )}

          {driverBlock}

          {isDone ? (
            <View style={[styles.card, styles.receipt]}>
              <Text style={styles.sectionLabel}>{t.history.receipt}</Text>
              {showFareBreakdown && baseFare != null && discountAmount != null && (
                <>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>{t.history.baseFare}</Text>
                    <Text style={styles.receiptValue}>{formatCurrency(baseFare)}</Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>{t.history.discountWithPercent.replace('{percent}', String(item.discountPercent))}</Text>
                    <Text style={styles.receiptDiscount}>−{formatCurrency(discountAmount)}</Text>
                  </View>
                  <View style={styles.receiptDivider} />
                </>
              )}
              <View style={styles.receiptRow}>
                <Text style={styles.totalLabel}>{t.history.totalPaid}</Text>
                <Text style={styles.totalValue}>{formatCurrency(item.fare)}</Text>
              </View>
              <View style={styles.paymentInner}>
                <IconTile icon={item.paymentMethod === 'gcash' ? 'wallet-outline' : 'cash-outline'} tone="navy" size={30} />
                <Text style={styles.paymentName}>{paymentName}</Text>
                {paymentLabel && <StatusPill label={paymentLabel} tone={paymentTone} />}
              </View>
              {referenceRow}
              <EmailReceiptButton rideRequestId={item.id} />
            </View>
          ) : (
            referenceRow && <View style={styles.refRowPad}>{referenceRow}</View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(26, insets.bottom + 12) }]}>
        <Pressable accessibilityRole="button" onPress={handleGetHelp} style={styles.helpButton}>
          <Ionicons name="flag-outline" size={16} color={colors.inkSoft} />
          <Text {...ADAPTIVE_LABEL_PROPS} style={styles.helpText}>{t.history.getHelp}</Text>
        </Pressable>
        <View style={styles.primarySlot}>
          <View style={styles.primaryShadow}>
            <Pressable accessibilityRole="button" onPress={handleBookAgain}>
              <GradientSurface token="button" direction="diagonal" style={styles.primary}>
                <Ionicons name="refresh" size={17} color={colors.white} />
                <Text style={styles.primaryText} {...ADAPTIVE_LABEL_PROPS}>
                  {isDone ? t.history.bookRouteAgain : t.history.tryRideAgain}
                </Text>
              </GradientSurface>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
