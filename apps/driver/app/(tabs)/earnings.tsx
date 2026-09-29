import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMotif, GradientSurface, colors, useTutorialTarget } from '@trisakay/ui';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useEarningsStore } from '../../src/store/useEarningsStore';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { useSettingsStore } from '../../src/store/useSettingsStore';
import { useEarningsTutorialDemo } from '../../src/hooks/useTutorialDemoState';
import { formatCurrency } from '../../src/utils/currency';
import { interpolate } from '../../src/utils/interpolate';
import type { DailyEarning, PeakHourBucket } from '../../src/types/earnings';
import type { TripHistoryItem } from '../../src/types/history';
import { styles } from '../../src/styles/tabs/earnings.styles';

type Period = 'today' | 'week' | 'month';

const MANILA_TZ = 'Asia/Manila';

interface Bucket {
  key: string;
  shortLabel: string;
  fullLabel: string;
  value: number;
  trips: number;
}

function manilaDayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: MANILA_TZ });
}

function manilaHour(iso: string): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: MANILA_TZ, hour: 'numeric', hourCycle: 'h23' }).format(new Date(iso)));
}

function manilaOffsetDayKey(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: MANILA_TZ });
}

function weekdayShort(dayKey: string): string {
  return new Date(`${dayKey}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short', timeZone: MANILA_TZ });
}

function shortMonthDay(dayKey: string): string {
  return new Date(`${dayKey}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: MANILA_TZ });
}

function dayNum(dayKey: string): string {
  return String(Number(dayKey.slice(8, 10)));
}

const TODAY_SLOTS: { startHour: number; endHour: number; shortLabel: string; fullLabel: string }[] = [
  { startHour: 6, endHour: 9, shortLabel: '6a', fullLabel: '6–9 AM' },
  { startHour: 9, endHour: 12, shortLabel: '9a', fullLabel: '9–12 NN' },
  { startHour: 12, endHour: 15, shortLabel: '12n', fullLabel: '12–3 PM' },
  { startHour: 15, endHour: 18, shortLabel: '3p', fullLabel: '3–6 PM' },
  { startHour: 18, endHour: 21, shortLabel: '6p', fullLabel: '6–9 PM' },
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export default function EarningsScreen() {
  const t = useTranslation();
  const tutorialDemo = useEarningsTutorialDemo();
  const trackedTotalTarget = useTutorialTarget('tracked-total');

  const dailyBreakdown = useEarningsStore((state) => state.dailyBreakdown);
  const loading = useEarningsStore((state) => state.loading);
  const earningsError = useEarningsStore((state) => state.error);
  const load = useEarningsStore((state) => state.load);
  const peakHours = useEarningsStore((state) => state.peakHours);
  const peakHoursError = useEarningsStore((state) => state.peakHoursError);

  const trips = useHistoryStore((state) => state.trips);
  const loadHistory = useHistoryStore((state) => state.load);

  const dailyGoal = useSettingsStore((state) => state.dailyGoal);

  const [period, setPeriod] = useState<Period>('week');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    void load();
    void loadHistory();
  }, [load, loadHistory]);

  const todayKey = manilaOffsetDayKey(0);
  const doneTrips = useMemo(() => trips.filter((trip) => trip.status === 'done'), [trips]);

  const weekDayKeys = useMemo(() => Array.from({ length: 7 }, (_, i) => manilaOffsetDayKey(6 - i)), [todayKey]);
  const [y, m] = todayKey.split('-').map(Number);
  const monthKey = `${y}-${pad2(m)}`;
  const daysInMonth = new Date(y, m, 0).getDate();

  const dailyByKey = useMemo(() => {
    const map = new Map<string, DailyEarning>();
    for (const day of dailyBreakdown) map.set(day.date, day);
    return map;
  }, [dailyBreakdown]);

  const todayBuckets: Bucket[] = useMemo(
    () =>
      TODAY_SLOTS.map((slot) => {
        const slotTrips = doneTrips.filter(
          (trip) => manilaDayKey(trip.date) === todayKey && manilaHour(trip.date) >= slot.startHour && manilaHour(trip.date) < slot.endHour
        );
        return {
          key: `${slot.startHour}`,
          shortLabel: slot.shortLabel,
          fullLabel: slot.fullLabel,
          value: slotTrips.reduce((sum, trip) => sum + (trip.fare ?? 0), 0),
          trips: slotTrips.length,
        };
      }),
    [doneTrips, todayKey]
  );

  const weekBuckets: Bucket[] = useMemo(
    () =>
      weekDayKeys.map((key, i) => {
        const entry = dailyByKey.get(key);
        return {
          key,
          shortLabel: i === 6 ? t.driver.earnings.today : weekdayShort(key),
          fullLabel: shortMonthDay(key),
          value: entry?.totalCollected ?? 0,
          trips: entry?.ridesCompleted ?? 0,
        };
      }),
    [weekDayKeys, dailyByKey, t]
  );

  const monthChunks: [number, number][] = [
    [1, 7],
    [8, 14],
    [15, 21],
    [22, daysInMonth],
  ];
  const monthAbbrev = new Date(`${monthKey}-01T00:00:00`).toLocaleDateString('en-PH', { month: 'short', timeZone: MANILA_TZ });
  const monthBuckets: Bucket[] = useMemo(
    () =>
      monthChunks.map(([startD, endD], i) => {
        const entries = dailyBreakdown.filter((day) => day.date.startsWith(`${monthKey}-`) && Number(day.date.slice(8, 10)) >= startD && Number(day.date.slice(8, 10)) <= endD);
        return {
          key: `wk${i + 1}`,
          shortLabel: `Wk ${i + 1}`,
          fullLabel: `${monthAbbrev} ${startD} – ${endD}`,
          value: entries.reduce((sum, day) => sum + day.totalCollected, 0),
          trips: entries.reduce((sum, day) => sum + day.ridesCompleted, 0),
        };
      }),
    [dailyBreakdown, monthKey, monthAbbrev]
  );

  const buckets = period === 'today' ? todayBuckets : period === 'week' ? weekBuckets : monthBuckets;

  useEffect(() => {
    setSelectedIndex(null);
  }, [period]);

  const activeIndex = selectedIndex !== null && selectedIndex < buckets.length ? selectedIndex : buckets.length - 1;
  const selectedBucket = buckets[activeIndex];

  const periodTotal = buckets.reduce((sum, bucket) => sum + bucket.value, 0);
  const periodTripCount = buckets.reduce((sum, bucket) => sum + bucket.trips, 0);
  const displayTotal = tutorialDemo.active ? tutorialDemo.data.totalTracked : periodTotal;

  const rangeLabel =
    period === 'today'
      ? interpolate(t.driver.earnings.todayRangeLabel, { date: new Date(`${todayKey}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', timeZone: MANILA_TZ }) })
      : period === 'week'
        ? `${shortMonthDay(weekDayKeys[0])} – ${dayNum(weekDayKeys[6])}`
        : new Date(`${monthKey}-01T00:00:00`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: MANILA_TZ });

  const prevWeekTotal = useMemo(() => {
    const prevKeys = Array.from({ length: 7 }, (_, i) => manilaOffsetDayKey(13 - i));
    return prevKeys.reduce((sum, key) => sum + (dailyByKey.get(key)?.totalCollected ?? 0), 0);
  }, [dailyByKey, todayKey]);

  let pm = m - 1;
  let py = y;
  if (pm === 0) {
    pm = 12;
    py = y - 1;
  }
  const prevMonthKey = `${py}-${pad2(pm)}`;
  const prevMonthTotal = useMemo(
    () => dailyBreakdown.filter((day) => day.date.startsWith(`${prevMonthKey}-`)).reduce((sum, day) => sum + day.totalCollected, 0),
    [dailyBreakdown, prevMonthKey]
  );
  const prevMonthShortName = new Date(`${prevMonthKey}-01T00:00:00`).toLocaleDateString('en-PH', { month: 'short', timeZone: MANILA_TZ });

  const weekDeltaPercent = prevWeekTotal > 0 ? Math.round(((periodTotal - prevWeekTotal) / prevWeekTotal) * 100) : null;
  const monthDeltaPercent = prevMonthTotal > 0 ? Math.round(((periodTotal - prevMonthTotal) / prevMonthTotal) * 100) : null;

  const showDeltaPill = period === 'today' || (period === 'week' && weekDeltaPercent !== null && weekDeltaPercent >= 0) || (period === 'month' && monthDeltaPercent !== null && monthDeltaPercent >= 0);
  const deltaPillText =
    period === 'today'
      ? interpolate(t.driver.earnings.tripsSoFar, { n: periodTripCount })
      : period === 'week'
        ? interpolate(t.driver.earnings.vsLastWeek, { n: weekDeltaPercent ?? 0 })
        : interpolate(t.driver.earnings.vsPrevMonth, { n: monthDeltaPercent ?? 0, month: prevMonthShortName });

  function isTripInPeriod(trip: TripHistoryItem): boolean {
    const key = manilaDayKey(trip.date);
    if (period === 'today') return key === todayKey;
    if (period === 'week') return weekDayKeys.includes(key);
    return key.startsWith(`${monthKey}-`);
  }

  // Only `paid` trips, matching v_driver_earnings' own `txn.status = 'paid'`
  // join — otherwise a completed-but-unpaid cash ride shows up here while
  // the period total/avg-fare tiles (sourced from that view) still read
  // ₱0.00 for the same period, which looked like a contradiction on device.
  const periodDoneTrips = useMemo(
    () => doneTrips.filter((trip) => isTripInPeriod(trip) && trip.paymentStatus === 'paid'),
    [doneTrips, period, todayKey, weekDayKeys, monthKey]
  );
  const cashFareSum = periodDoneTrips.filter((trip) => trip.paymentMethod === 'cash').reduce((sum, trip) => sum + (trip.fare ?? 0), 0);
  const tripFareSum = periodDoneTrips.reduce((sum, trip) => sum + (trip.fare ?? 0), 0);
  const cashSharePercent = tripFareSum > 0 ? Math.round((cashFareSum / tripFareSum) * 100) : 0;

  const avgFare = periodTripCount > 0 ? Math.round(periodTotal / periodTripCount) : 0;
  const bestBucket = buckets.reduce((best, bucket) => (bucket.value > best.value ? bucket : best), buckets[0]);

  const showGoalLine = dailyGoal !== null && dailyGoal > 0;
  const daysHitGoal = weekBuckets.filter((bucket) => bucket.value >= (dailyGoal ?? 0)).length;
  const goalLineText = showGoalLine
    ? period === 'week'
      ? interpolate(t.driver.earnings.goalHitDays, { goal: dailyGoal!.toLocaleString('en-PH'), n: daysHitGoal })
      : interpolate(t.driver.earnings.dailyGoalLine, { goal: dailyGoal!.toLocaleString('en-PH') })
    : '';

  const maxBucketValue = Math.max(...buckets.map((bucket) => bucket.value), 1);

  // Peak-hours: existing city-wide, fixed 30-day, 12×2-hour-bucket data
  // source (per Phase 0 decision 2) — restyled only, no ₱/hr available so
  // counts are shown instead (README §5's own escape hatch).
  const peakIndex = peakHours.reduce((best, bucket, i) => (bucket.count > peakHours[best]?.count ? i : best), 0);
  const peakBucket: PeakHourBucket | undefined = peakHours[peakIndex];
  const maxPeakCount = Math.max(...peakHours.map((bucket) => bucket.count), 1);

  function shortHourWindow(hourLabel: string | undefined): string {
    if (!hourLabel) return '—';
    const [start, end] = hourLabel.split('–');
    const startNum = start.trim().split(':')[0];
    const startPeriod = start.trim().split(' ')[1];
    const endNum = end.trim().split(':')[0];
    const endPeriod = end.trim().split(' ')[1];
    return startPeriod === endPeriod ? `${startNum} – ${endNum} ${endPeriod}` : `${startNum} ${startPeriod} – ${endNum} ${endPeriod}`;
  }

  const morningIndex = useMemo(() => {
    const candidates = peakHours.map((b, i) => ({ b, i })).filter(({ i }) => i >= 3 && i <= 5);
    return candidates.reduce((best, cur) => (cur.b.count > best.b.count ? cur : best), candidates[0])?.i ?? 3;
  }, [peakHours]);
  const eveningIndex = useMemo(() => {
    const candidates = peakHours.map((b, i) => ({ b, i })).filter(({ i }) => i >= 8 && i <= 10);
    return candidates.reduce((best, cur) => (cur.b.count > best.b.count ? cur : best), candidates[0])?.i ?? 9;
  }, [peakHours]);
  const quietestIndex = useMemo(() => {
    const nonZero = peakHours.map((b, i) => ({ b, i })).filter(({ b }) => b.count > 0);
    const pool = nonZero.length > 0 ? nonZero : peakHours.map((b, i) => ({ b, i }));
    return pool.reduce((best, cur) => (cur.b.count < best.b.count ? cur : best), pool[0])?.i ?? 0;
  }, [peakHours]);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.heroShadow}>
        <GradientSurface token="hero" direction="diagonal" style={styles.heroBand}>
          <BrandMotif size={200} color={colors.white} opacity={0.12} style={styles.motif} />

          <SafeAreaView edges={['top']} style={styles.heroBandInner}>
            <View style={styles.segmentRow}>
              {(['today', 'week', 'month'] as Period[]).map((option) => {
                const active = option === period;
                const label = option === 'today' ? t.driver.earnings.periodToday : option === 'week' ? t.driver.earnings.periodWeek : t.driver.earnings.periodMonth;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setPeriod(option)}
                    style={[styles.segmentItem, active && styles.segmentItemActive]}
                  >
                    <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View {...trackedTotalTarget}>
              <Text style={styles.rangeEyebrow}>{rangeLabel}</Text>
              <Text style={styles.periodTotal}>{formatCurrency(displayTotal)}</Text>
              <View style={styles.deltaRow}>
                {showDeltaPill && (
                  <View style={styles.deltaPill}>
                    <Ionicons name="arrow-up" size={12} color={colors.accentGreenSoft} />
                    <Text style={styles.deltaPillText}>{deltaPillText}</Text>
                  </View>
                )}
                <Text style={styles.deltaTripCount}>{interpolate(t.driver.earnings.tripsCount, { count: periodTripCount })}</Text>
              </View>
            </View>
          </SafeAreaView>
        </GradientSurface>
      </View>

      {earningsError && <Text style={styles.error}>{earningsError}</Text>}

      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
        <View style={styles.chartCard}>
          <View style={styles.chartHeaderRow}>
            <View>
              <Text style={styles.chartHeaderLabel}>{selectedBucket?.fullLabel}</Text>
              <Text style={styles.chartHeaderValue}>{formatCurrency(selectedBucket?.value ?? 0)}</Text>
            </View>
            <View style={styles.chartHeaderChip}>
              <Text style={styles.chartHeaderChipText}>{interpolate(t.driver.earnings.tripsCount, { count: selectedBucket?.trips ?? 0 })}</Text>
            </View>
          </View>

          <View style={styles.barsRow}>
            {buckets.map((bucket, i) => {
              const selected = i === activeIndex;
              const heightPercent = Math.max((bucket.value / maxBucketValue) * 100, 8);
              return (
                <Pressable key={bucket.key} style={styles.barColumn} onPress={() => setSelectedIndex(i)} accessibilityRole="button">
                  <View style={[styles.bar, selected ? styles.barSelected : styles.barUnselected, { height: `${heightPercent}%` }]} />
                </Pressable>
              );
            })}
          </View>
          <View style={styles.barLabelsRow}>
            {buckets.map((bucket) => (
              <Text key={bucket.key} style={styles.barLabel}>
                {bucket.shortLabel}
              </Text>
            ))}
          </View>

          {showGoalLine && (
            <View style={styles.goalLineWrap}>
              <View style={styles.goalDash} />
              <Text style={styles.goalLineText}>{goalLineText}</Text>
            </View>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>{t.driver.earnings.avgFareLabel}</Text>
            <Text style={styles.statValue}>{formatCurrency(avgFare)}</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>{t.driver.earnings.bestLabel}</Text>
            <Text style={styles.statValue}>{bestBucket?.shortLabel ?? '—'}</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>{t.driver.earnings.cashLabel}</Text>
            <Text style={styles.statValue}>{cashSharePercent}%</Text>
          </View>
        </View>

        <View style={styles.peakHeaderRow}>
          <Text style={styles.peakEyebrow}>{t.driver.earnings.peakHoursEyebrow}</Text>
          <Text style={styles.peakScope}>{t.driver.earnings.peakHoursScope}</Text>
        </View>

        {peakHoursError ? (
          <Text style={styles.error}>{peakHoursError}</Text>
        ) : (
          <View style={styles.peakCard}>
            <View style={styles.bestTimeRow}>
              <View style={styles.bestTimeTile}>
                <Ionicons name="time-outline" size={22} color={colors.accentGreenPressed} />
              </View>
              <View style={styles.bestTimeTextCol}>
                <Text style={styles.bestTimeLabel}>{t.driver.earnings.bestTimeLabel}</Text>
                <Text style={styles.bestTimeValue}>{shortHourWindow(peakBucket?.hourLabel)}</Text>
              </View>
              <View style={styles.bestTimeChip}>
                <Text style={styles.bestTimeChipText} numberOfLines={1}>
                  {interpolate(t.driver.earnings.tripsCount, { count: peakBucket?.count ?? 0 })}
                </Text>
              </View>
            </View>

            <View style={styles.hourBarsRow}>
              {peakHours.map((bucket, i) => {
                const heightPercent = Math.max((bucket.count / maxPeakCount) * 100, 4);
                return (
                  <View key={bucket.hourLabel} style={styles.hourBarColumn}>
                    <View style={[styles.hourBar, i === peakIndex && bucket.count > 0 ? styles.hourBarPeak : styles.hourBarNormal, { height: `${heightPercent}%` }]} />
                  </View>
                );
              })}
            </View>
            <View style={styles.hourAxisRow}>
              <Text style={styles.hourAxisLabel}>12 MN</Text>
              <Text style={styles.hourAxisLabel}>6 AM</Text>
              <Text style={styles.hourAxisLabel}>12 NN</Text>
              <Text style={styles.hourAxisLabel}>6 PM</Text>
            </View>

            <View style={[styles.peakRow, styles.peakRowFirst]}>
              <View style={[styles.peakSwatch, styles.peakSwatchGreen]} />
              <Text style={styles.peakRowLabel}>{interpolate(t.driver.earnings.morningRush, { window: shortHourWindow(peakHours[morningIndex]?.hourLabel) })}</Text>
              <Text style={styles.peakRowValue}>{interpolate(t.driver.earnings.tripsCount, { count: peakHours[morningIndex]?.count ?? 0 })}</Text>
            </View>
            <View style={styles.peakRow}>
              <View style={[styles.peakSwatch, styles.peakSwatchGreen]} />
              <Text style={styles.peakRowLabel}>{interpolate(t.driver.earnings.eveningRush, { window: shortHourWindow(peakHours[eveningIndex]?.hourLabel) })}</Text>
              <Text style={styles.peakRowValue}>{interpolate(t.driver.earnings.tripsCount, { count: peakHours[eveningIndex]?.count ?? 0 })}</Text>
            </View>
            <View style={styles.peakRow}>
              <View style={[styles.peakSwatch, styles.peakSwatchBlue]} />
              <Text style={[styles.peakRowLabel, styles.peakRowLabelMuted]}>{interpolate(t.driver.earnings.quietest, { window: shortHourWindow(peakHours[quietestIndex]?.hourLabel) })}</Text>
              <Text style={styles.peakRowValue}>{interpolate(t.driver.earnings.tripsCount, { count: peakHours[quietestIndex]?.count ?? 0 })}</Text>
            </View>

            <View style={styles.infoNote}>
              <Ionicons name="information-circle-outline" size={16} color={colors.inkSoft} />
              <Text style={styles.infoNoteText}>{t.driver.earnings.peakHoursCaption}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
