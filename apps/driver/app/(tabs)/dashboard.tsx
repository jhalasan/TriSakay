import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { haversineKm } from '@trisakay/shared';
import { Avatar, BrandMotif, GradientSurface, PulseRing, RequestCard, colors, useTutorialTarget } from '@trisakay/ui';
import type { PendingRequest } from '@trisakay/ui';
import { useAcceptRideRequest } from '../../src/hooks/useAcceptRideRequest';
import { getPositionForGoOnline } from '../../src/utils/currentPosition';
import { useDriverUnit } from '../../src/hooks/useDriverUnit';
import { useRequestCountdown } from '../../src/hooks/useRequestCountdown';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useDashboardTutorialDemo } from '../../src/hooks/useTutorialDemoState';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useDriverStore } from '../../src/store/useDriverStore';
import { useEarningsStore } from '../../src/store/useEarningsStore';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { useNotificationsStore } from '../../src/store/useNotificationsStore';
import { useRequestsStore } from '../../src/store/useRequestsStore';
import { useSettingsStore } from '../../src/store/useSettingsStore';
import { useTripStore } from '../../src/store/useTripStore';
import { CLUSTER_LABEL } from '../../src/utils/cluster';
import { formatAmount, formatCurrency } from '../../src/utils/currency';
import { interpolate } from '../../src/utils/interpolate';
import type { TripHistoryItem } from '../../src/types/history';
import { styles } from '../../src/styles/tabs/dashboard.styles';

// Dev-only overrides for reaching every state without live backend data:
// globalThis.__TRISAKAY_MOCK_ONLINE__ = true | false
// globalThis.__TRISAKAY_MOCK_REQUEST__ = true  (forces the incoming-request slot with a fake request)
declare global {
  // eslint-disable-next-line no-var
  var __TRISAKAY_MOCK_ONLINE__: boolean | undefined;
  // eslint-disable-next-line no-var
  var __TRISAKAY_MOCK_REQUEST__: boolean | undefined;
}

// Typed against @trisakay/ui's PendingRequest (which declares
// pickupDistanceMeters/expiresAt as optional) rather than the app's own
// PendingRequest (apps/driver/src/types/request.ts, which doesn't have
// those fields yet — they arrive with a future backend migration). Using
// the ui package's type here lets real store items (missing those fields)
// and this mock (which has them) share one array type without a union-typed
// `incoming` that TS would refuse property access on.
const MOCK_REQUEST: PendingRequest = {
  id: '__mock__',
  seats: 2,
  paymentMethod: 'cash',
  pickupLabel: 'Poblacion Plaza, waiting shed',
  dropoffLabel: 'Public Market, Stall 14',
  fare: 45,
  createdAt: new Date().toISOString(),
  pickupDistanceMeters: 400,
  expiresAt: new Date(Date.now() + 18_000).toISOString(),
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getGreetingKey(hour: number): 'greetingMorning' | 'greetingAfternoon' | 'greetingEvening' {
  if (hour < 12) return 'greetingMorning';
  if (hour < 18) return 'greetingAfternoon';
  return 'greetingEvening';
}

function firstNameOf(name: string | undefined | null, fallback: string): string {
  if (!name) return fallback;
  return name.trim().split(/\s+/)[0];
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isToday(iso: string): boolean {
  return isSameCalendarDay(new Date(iso), new Date());
}

function isYesterday(iso: string): boolean {
  const yesterday = new Date(Date.now() - MS_PER_DAY);
  return isSameCalendarDay(new Date(iso), yesterday);
}

/** "Today, 7:48 PM" / "Yesterday, 7:48 PM" / "Sep 12, 7:48 PM" — matches README §3b/3c's recent/last-trip meta line. */
function formatTripMeta(iso: string, todayLabel: string, yesterdayLabel: string): string {
  const time = new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  if (isToday(iso)) return `${todayLabel}, ${time}`;
  if (isYesterday(iso)) return `${yesterdayLabel}, ${time}`;
  const date = new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  return `${date}, ${time}`;
}

/** "Dec 2026" — offline footer's franchise-expiry clause. */
function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
}

interface WeekSummary {
  earnedThisWeek: number;
  tripsThisWeek: number;
  /** Percent change vs the 7 days before this week — null when there's no prior-week data to compare against (not "unknown", genuinely nothing to divide by). */
  deltaPercent: number | null;
}

function summarizeWeek(dailyBreakdown: { date: string; ridesCompleted: number; totalCollected: number }[]): WeekSummary {
  const now = Date.now();
  let earnedThisWeek = 0;
  let tripsThisWeek = 0;
  let earnedPrevWeek = 0;

  for (const row of dailyBreakdown) {
    const t = new Date(row.date).getTime();
    if (t <= now && t > now - 7 * MS_PER_DAY) {
      earnedThisWeek += row.totalCollected;
      tripsThisWeek += row.ridesCompleted;
    } else if (t <= now - 7 * MS_PER_DAY && t > now - 14 * MS_PER_DAY) {
      earnedPrevWeek += row.totalCollected;
    }
  }

  const deltaPercent = earnedPrevWeek > 0 ? Math.round(((earnedThisWeek - earnedPrevWeek) / earnedPrevWeek) * 100) : null;
  return { earnedThisWeek, tripsThisWeek, deltaPercent };
}

function RecentTripRow({ trip, todayLabel, yesterdayLabel, passengerFallback }: { trip: TripHistoryItem; todayLabel: string; yesterdayLabel: string; passengerFallback: string }) {
  return (
    <View style={styles.tripRow}>
      <View style={styles.tripIconTile}>
        <Ionicons name="checkmark" size={18} color={colors.accentGreenPressed} />
      </View>
      <View style={styles.tripTextSlot}>
        <Text style={styles.tripRoute} numberOfLines={1}>
          {trip.pickup ?? '—'} → {trip.dropoff ?? '—'}
        </Text>
        <Text style={styles.tripMeta} numberOfLines={1}>
          {formatTripMeta(trip.date, todayLabel, yesterdayLabel)} · {trip.passengerName || passengerFallback}
        </Text>
      </View>
      <Text style={styles.tripFare}>{trip.fare !== null ? formatCurrency(trip.fare) : '—'}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const t = useTranslation();
  const user = useAuthStore((state) => state.user);
  const driverUnit = useDriverUnit();

  const tutorialDemo = useDashboardTutorialDemo();
  const dutyConsoleTarget = useTutorialTarget('duty-console');
  const earningsTodayTarget = useTutorialTarget('earnings-today');
  const incomingRequestTarget = useTutorialTarget('incoming-request');

  const isAvailableReal = useDriverStore((state) => state.isAvailable);
  const isAvailable = tutorialDemo.active
    ? tutorialDemo.data.isAvailable
    : __DEV__ && globalThis.__TRISAKAY_MOCK_ONLINE__ !== undefined
      ? globalThis.__TRISAKAY_MOCK_ONLINE__
      : isAvailableReal;
  const setAvailable = useDriverStore((state) => state.setAvailable);
  const availabilityError = useDriverStore((state) => state.error);
  const todayEarningsReal = useDriverStore((state) => state.todayEarnings);
  const todayEarnings = tutorialDemo.active ? tutorialDemo.data.todayEarnings : todayEarningsReal;
  const todayTripsReal = useDriverStore((state) => state.todayTrips);
  const todayTrips = tutorialDemo.active ? tutorialDemo.data.todayTrips : todayTripsReal;
  const ratingReal = useDriverStore((state) => state.rating);
  const rating = tutorialDemo.active ? tutorialDemo.data.rating : ratingReal;
  const ratingCountReal = useDriverStore((state) => state.ratingCount);
  const ratingCount = tutorialDemo.active ? tutorialDemo.data.ratingCount : ratingCountReal;
  const acceptRateReal = useDriverStore((state) => state.acceptRate);
  const acceptRate = tutorialDemo.active ? tutorialDemo.data.acceptRate : acceptRateReal;

  const [togglingAvailability, setTogglingAvailability] = useState(false);
  // State updates lag a render behind a fast double-tap, so a ref is the actual re-entry guard.
  const togglingRef = useRef(false);
  const unreadCount = useNotificationsStore((state) => state.items.filter((item) => !item.read).length);

  const dailyGoal = useSettingsStore((state) => state.dailyGoal);
  const historyTrips = useHistoryStore((state) => state.trips);
  const loadHistory = useHistoryStore((state) => state.load);
  const dailyBreakdown = useEarningsStore((state) => state.dailyBreakdown);
  const loadEarnings = useEarningsStore((state) => state.load);

  useEffect(() => {
    void loadHistory();
    void loadEarnings();
  }, [loadHistory, loadEarnings]);

  const pendingReal = useRequestsStore((state) => state.pending);
  const pending: PendingRequest[] = tutorialDemo.active
    ? tutorialDemo.data.pending
    : __DEV__ && globalThis.__TRISAKAY_MOCK_REQUEST__
      ? [MOCK_REQUEST, ...pendingReal]
      : pendingReal;
  const requestError = useRequestsStore((state) => state.error);
  const decline = useRequestsStore((state) => state.decline);

  const { acceptRideRequest, acceptingId } = useAcceptRideRequest();
  const activeTrip = useTripStore((state) => state.current);

  const incoming = pending[0];
  const countdownReal = useRequestCountdown(incoming?.expiresAt ?? null);
  const countdown = tutorialDemo.active ? tutorialDemo.data.countdown : countdownReal;

  async function handleToggleAvailable(next: boolean) {
    if (togglingRef.current) return;
    togglingRef.current = true;
    setTogglingAvailability(true);
    try {
      let coords: { lat: number; lng: number; mocked?: boolean } | undefined;
      if (next) {
        try {
          // Bounded wait: a slow GPS fix falls back to a recent last-known position instead of hanging.
          const position = await getPositionForGoOnline();
          coords = { lat: position.coords.latitude, lng: position.coords.longitude, mocked: position.mocked };
        } catch {
          useDriverStore.setState({ error: t.driver.dashboard.locationError });
          return;
        }
      }
      await setAvailable(next, coords);
    } finally {
      togglingRef.current = false;
      setTogglingAvailability(false);
    }
  }

  if (activeTrip) {
    return <Redirect href="/trip/active" />;
  }

  const requestExpired = incoming?.expiresAt != null && countdown === 0;
  const showListening = isAvailable && (!incoming || requestExpired);

  const zoneLabel = driverUnit?.cluster ? CLUSTER_LABEL[driverUnit.cluster] : null;
  const showGoal = dailyGoal !== null && dailyGoal > 0;
  const goalPercent = showGoal ? Math.min(100, (todayEarnings / dailyGoal) * 100) : 0;
  const goalReached = showGoal && todayEarnings >= dailyGoal;

  const doneTrips = historyTrips.filter((trip) => trip.status === 'done');
  const hasTripToday = doneTrips.some((trip) => isToday(trip.date));
  const recentTrips = hasTripToday ? doneTrips.slice(0, 2) : [];
  const lastTrip = doneTrips[0] ?? null;
  const week = summarizeWeek(dailyBreakdown);

  const distanceKm =
    incoming?.pickupLat != null && incoming?.pickupLng != null && incoming?.destLat != null && incoming?.destLng != null
      ? haversineKm(incoming.pickupLat, incoming.pickupLng, incoming.destLat, incoming.destLng)
      : null;
  const totalSeconds =
    incoming?.expiresAt && incoming?.createdAt
      ? Math.round((Date.parse(incoming.expiresAt) - Date.parse(incoming.createdAt)) / 1000)
      : null;

  const greeting = t.driver.dashboard[getGreetingKey(new Date().getHours())];
  const firstName = firstNameOf(user?.name, t.driver.dashboard.driverFallback);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.identityRow}>
          <Avatar name={user?.name} source={user?.avatarUrl ? { uri: user.avatarUrl } : undefined} size="md" />
          <View style={styles.identityTextSlot}>
            <Text style={styles.greetingLine}>{greeting}</Text>
            <Text style={styles.firstNameText} numberOfLines={1}>
              {firstName}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.driver.dashboard.notificationsAccessibilityLabel}
            style={styles.bellButton}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications-outline" size={21} color={colors.ink} />
            {unreadCount > 0 && <View style={styles.bellDot} />}
          </Pressable>
        </View>

        {isAvailable ? (
          <View {...dutyConsoleTarget} style={styles.heroShadowWrap}>
            <GradientSurface token="hero" direction="diagonal" style={styles.consoleOnline}>
              <BrandMotif size={200} color={colors.white} opacity={0.1} style={styles.consoleMotif} />
              <View style={styles.statusRow}>
                <View style={styles.statusLeft}>
                  <View style={styles.pulseHost}>
                    <PulseRing size={10} color={colors.accentGreenSoft} durationMs={2000} style={{ position: 'absolute' }} />
                    <View style={styles.statusDotStatic} />
                  </View>
                  <View>
                    <Text style={styles.youreOnlineText}>{t.driver.dashboard.youreOnline}</Text>
                    {zoneLabel && <Text style={styles.zoneLine}>{interpolate(t.driver.dashboard.zoneLine, { zone: zoneLabel })}</Text>}
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.driver.dashboard.goOffline}
                  disabled={togglingAvailability || tutorialDemo.active}
                  onPress={() => (tutorialDemo.active ? undefined : handleToggleAvailable(false))}
                  style={styles.goOfflineButton}
                >
                  {togglingAvailability ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="power" size={15} color={colors.white} />}
                  <Text style={styles.goOfflineText}>{togglingAvailability ? t.driver.dashboard.goingOffline : t.driver.dashboard.goOffline}</Text>
                </Pressable>
              </View>

              <View {...earningsTodayTarget}>
                <Text style={styles.earnedTodayEyebrow}>{t.driver.dashboard.earnedTodayEyebrow}</Text>
                <Text style={styles.earningsAmount}>{formatCurrency(todayEarnings)}</Text>
              </View>

              {showGoal && (
                <View style={styles.goalBlock}>
                  <View style={styles.goalTrack}>
                    <View style={[styles.goalFill, { width: `${goalPercent}%` }]} />
                  </View>
                  <View style={styles.goalRow}>
                    <Text style={styles.goalText}>
                      {goalReached
                        ? t.driver.dashboard.goalReached
                        : interpolate(t.driver.dashboard.goalToGo, { amount: formatAmount(dailyGoal! - todayEarnings) })}
                    </Text>
                    <Text style={styles.goalText}>{interpolate(t.driver.dashboard.goalLabel, { amount: dailyGoal!.toLocaleString('en-PH') })}</Text>
                  </View>
                </View>
              )}

              <View style={styles.statsGrid}>
                <View style={styles.statTile}>
                  <Text style={styles.statValue}>{todayTrips}</Text>
                  <Text style={styles.statLabel}>{t.driver.dashboard.statTripsLabel}</Text>
                </View>
                <View style={styles.statTile}>
                  <View style={styles.statValueRow}>
                    <Text style={styles.statValue}>{ratingCount > 0 && rating !== null ? rating.toFixed(1) : '—'}</Text>
                    <Ionicons name="star" size={13} color={colors.white} />
                  </View>
                  <Text style={styles.statLabel}>{t.driver.dashboard.statRatingLabel}</Text>
                </View>
                <View style={styles.statTile}>
                  <Text style={styles.statValue}>{acceptRate !== null ? `${Math.round(acceptRate * 100)}%` : '—'}</Text>
                  <Text style={styles.statLabel}>{t.driver.dashboard.statAcceptedLabel}</Text>
                </View>
              </View>
            </GradientSurface>
          </View>
        ) : (
          <View style={styles.offlineStatusCardShadowWrap}>
            <View style={styles.offlineStatusCard}>
              <BrandMotif size={190} color={colors.accentBlue} opacity={0.05} style={styles.offlineMotif} />
              <View style={styles.offlineBadgeRow}>
                <View style={styles.offlineDot} />
                <Text style={styles.offlineBadgeText}>{t.driver.dashboard.youreOffline}</Text>
              </View>
              <Text style={styles.readyTitle}>{t.driver.dashboard.readyTitle}</Text>
              <Text style={styles.readyBody}>
                {zoneLabel ? interpolate(t.driver.dashboard.readyBodyWithZone, { zone: zoneLabel }) : t.driver.dashboard.readyBodyNoZone}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.driver.dashboard.goOnline}
                onPress={() => handleToggleAvailable(true)}
                disabled={togglingAvailability}
                style={styles.goOnlineButtonShadowWrap}
              >
                <View style={styles.goOnlineButton}>
                  {togglingAvailability ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Ionicons name="power" size={20} color={colors.white} />
                  )}
                  <Text style={styles.goOnlineText}>{togglingAvailability ? t.driver.dashboard.goingOnline : t.driver.dashboard.goOnline}</Text>
                </View>
              </Pressable>

              <View style={styles.offlineFooter}>
                <Ionicons name="shield-checkmark" size={15} color={colors.accentGreen} />
                <Text style={styles.offlineFooterText} numberOfLines={1}>
                  {driverUnit?.verificationStatus === 'approved' ? t.driver.dashboard.pso : t.driver.dashboard.pendingVerification}
                  {driverUnit?.bodyNo ? ` · ${t.driver.dashboard.bodyNoPrefix} ${driverUnit.bodyNo}` : ''}
                  {driverUnit?.mtopExpiryDate ? ` · ${t.driver.dashboard.franchiseValidToPrefix} ${formatMonthYear(driverUnit.mtopExpiryDate)}` : ''}
                </Text>
              </View>
            </View>
          </View>
        )}

        {availabilityError && <Text style={styles.error}>{availabilityError}</Text>}

        {isAvailable && incoming && !requestExpired && (
          <View {...incomingRequestTarget}>
            <View style={styles.requestSectionHeader}>
              <Text style={styles.sectionLabel}>{t.driver.dashboard.incomingRequestEyebrow}</Text>
              {countdown !== null && (
                <View style={styles.countdownChip}>
                  <Ionicons name="time-outline" size={12} color={colors.danger} />
                  <Text style={styles.countdownChipText}>{interpolate(t.driver.dashboard.secondsLeft, { n: countdown })}</Text>
                </View>
              )}
            </View>
            <RequestCard
              request={incoming}
              variant="incoming"
              accepting={acceptingId === incoming.id}
              countdownSeconds={countdown}
              totalSeconds={totalSeconds}
              distanceKm={distanceKm}
              onAccept={() => (tutorialDemo.active ? undefined : acceptRideRequest(incoming.id))}
              onDecline={() => (tutorialDemo.active ? undefined : user && decline(incoming.id, user.id))}
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
          </View>
        )}

        {requestError && <Text style={styles.error}>{requestError}</Text>}

        {showListening && (
          <View style={styles.listeningSectionWrap}>
            <View style={styles.listeningPanelShadowWrap}>
              <View style={styles.listeningPanel}>
                <BrandMotif size={230} color={colors.accentBlue} opacity={0.045} style={styles.listeningMotif} />
                <View style={styles.listeningIconHost}>
                  <PulseRing size={60} color={colors.accentBlueSoft} durationMs={2400} style={{ position: 'absolute' }} />
                  <View style={styles.listeningIconCircle}>
                    <Ionicons name="radio-outline" size={28} color={colors.accentBlue} />
                  </View>
                </View>
                <View style={styles.listeningTextSlot}>
                  <Text style={styles.listeningTitle}>{t.driver.dashboard.listeningTitle}</Text>
                  <Text style={styles.listeningMessage}>{t.driver.dashboard.listeningMessage}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {showListening && recentTrips.length > 0 && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>{t.driver.dashboard.recentTripsEyebrow}</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/history')}>
                <Text style={styles.seeAllLink}>{t.driver.dashboard.seeAll} ›</Text>
              </Pressable>
            </View>
            <View style={styles.tripsPanel}>
              {recentTrips.map((trip, index) => (
                <View key={trip.id} style={index < recentTrips.length - 1 ? styles.tripRowDivider : undefined}>
                  <RecentTripRow
                    trip={trip}
                    todayLabel={t.driver.dashboard.todayLabel}
                    yesterdayLabel={t.driver.dashboard.yesterdayLabel}
                    passengerFallback={t.driver.history.passengerFallback}
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        {!isAvailable && (
          <>
            <View>
              <Text style={styles.sectionLabel}>{t.driver.dashboard.thisWeekTitle}</Text>
              <View style={styles.thisWeekGrid}>
                <View style={styles.thisWeekCard}>
                  <Text style={styles.thisWeekLabel}>{t.driver.dashboard.earnedLabel}</Text>
                  <Text style={styles.thisWeekValue}>{formatCurrency(week.earnedThisWeek)}</Text>
                  {week.deltaPercent !== null && week.deltaPercent > 0 && (
                    <View style={styles.deltaRow}>
                      <Ionicons name="arrow-up" size={11} color={colors.accentGreenPressed} />
                      <Text style={styles.deltaText}>{interpolate(t.driver.dashboard.vsLastWeek, { percent: week.deltaPercent })}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.thisWeekCard}>
                  <Text style={styles.thisWeekLabel}>{t.driver.dashboard.tripsLabel}</Text>
                  <Text style={styles.thisWeekValue}>{week.tripsThisWeek}</Text>
                </View>
              </View>
            </View>

            {lastTrip && (
              <View>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>{t.driver.dashboard.lastTripEyebrow}</Text>
                  <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/history')}>
                    <Text style={styles.seeAllLink}>{t.driver.dashboard.historyLink} ›</Text>
                  </Pressable>
                </View>
                <View style={styles.tripsPanel}>
                  <RecentTripRow
                    trip={lastTrip}
                    todayLabel={t.driver.dashboard.todayLabel}
                    yesterdayLabel={t.driver.dashboard.yesterdayLabel}
                    passengerFallback={t.driver.history.passengerFallback}
                  />
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
