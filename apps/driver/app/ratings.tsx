import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, NavyBandHeader, colors, recordsPalette } from '@trisakay/ui';
import { REPORT_PROMPT_MAX_SCORE, countRatingTags, ratingPercentages, scoreTone, type ScoreTone } from '@trisakay/shared';
import { useTranslation } from '../src/hooks/useTranslation';
import { useDriverStore } from '../src/store/useDriverStore';
import { useRatingsStore } from '../src/store/useRatingsStore';
import { interpolate } from '../src/utils/interpolate';
import { styles } from '../src/styles/ratings.styles';

type RatingsFilter = 'all' | 'withComments' | 'low';

const STAR_COLOR: Record<ScoreTone, string> = { danger: colors.danger, navy: colors.accentBlue, green: colors.accentGreen };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Read-only stars: filled ones take `filled`, the rest `empty`. Bespoke because the shared editable StarRating fills navy. */
function StaticStars({ value, size, filled, empty }: { value: number; size: number; filled: string; empty: string }) {
  return (
    <View style={styles.starsRow} accessible accessibilityRole="text" accessibilityLabel={`${value} / 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Ionicons key={i} name="star" size={size} color={i < value ? filled : empty} />
      ))}
    </View>
  );
}

export default function RatingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const ratings = useRatingsStore((state) => state.ratings);
  const loading = useRatingsStore((state) => state.loading);
  const ratingsError = useRatingsStore((state) => state.error);
  const load = useRatingsStore((state) => state.load);
  const rating = useDriverStore((state) => state.rating);
  const ratingCount = useDriverStore((state) => state.ratingCount);
  const [filter, setFilter] = useState<RatingsFilter>('all');

  const filterOptions = [
    { value: 'all' as const, label: t.driver.ratings.filterAll },
    { value: 'withComments' as const, label: t.driver.ratings.filterWithComments },
    { value: 'low' as const, label: t.driver.ratings.filterLow },
  ];

  const TAG_LABEL: Record<string, string> = {
    friendly: t.rateDriver.tagFriendly,
    safe_driving: t.rateDriver.tagSafeDriving,
    clean_vehicle: t.rateDriver.tagCleanVehicle,
    on_time: t.rateDriver.tagOnTime,
    late: t.rateDriver.tagLate,
    rude: t.rateDriver.tagRude,
    unsafe_driving: t.rateDriver.tagUnsafeDriving,
    poor_vehicle_condition: t.rateDriver.tagPoorVehicleCondition,
  };

  useEffect(() => {
    void load();
  }, [load]);

  // Distribution is computed from the ratings actually loaded (most recent 50),
  // so it approximates the true lifetime split rather than reading it exactly.
  const distribution = useMemo(() => {
    const stars = [5, 4, 3, 2, 1];
    const percents = ratingPercentages(stars.map((s) => ratings.filter((item) => item.stars === s).length));
    return stars.map((s, i) => ({ stars: s, percent: percents[i] }));
  }, [ratings]);

  const tagCounts = useMemo(() => countRatingTags(ratings), [ratings]);

  const filteredRatings = useMemo(() => {
    if (filter === 'withComments') return ratings.filter((item) => Boolean(item.comment));
    if (filter === 'low') return ratings.filter((item) => item.stars <= REPORT_PROMPT_MAX_SCORE);
    return ratings;
  }, [ratings, filter]);

  function handleReport(rideRequestId: string) {
    router.push({ pathname: '/complaints', params: { rideRequestId, category: 'low_rating' } });
  }

  const countLabel = interpolate(ratingCount === 1 ? t.driver.ratings.ratingsCountOne : t.driver.ratings.ratingsCount, { count: ratingCount });

  return (
    <View style={styles.container}>
      <NavyBandHeader
        title={t.driver.ratings.title}
        titleSize="lg"
        onBack={() => router.back()}
        backAccessibilityLabel={t.driver.ratings.backA11y}
        topInset={insets.top}
        paddingBottom={18}
        elevated
      >
        <View style={styles.bandBody}>
          {rating !== null && (
            <View style={styles.summaryRow}>
              <View style={styles.scoreCol}>
                <Text style={styles.score}>{rating.toFixed(1)}</Text>
                <StaticStars value={Math.round(rating)} size={13} filled={recordsPalette.onDarkGreen} empty="rgba(255, 255, 255, 0.22)" />
                <Text style={styles.count}>{countLabel}</Text>
              </View>
              <View style={styles.distCol}>
                {distribution.map(({ stars, percent }) => (
                  <View key={stars} style={styles.distRow}>
                    <Text style={styles.distStar}>{stars}</Text>
                    <View style={styles.distTrack}>
                      <View
                        style={[
                          styles.distFill,
                          { width: `${percent}%`, backgroundColor: stars === 1 ? recordsPalette.onDarkRed : recordsPalette.onDarkGreen },
                        ]}
                      />
                    </View>
                    <Text style={styles.distPct}>{percent}%</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          <View style={styles.filterRow}>
            {filterOptions.map((option) => {
              const active = option.value === filter;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setFilter(option.value)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </NavyBandHeader>

      {ratingsError && <Text style={styles.error}>{ratingsError}</Text>}

      <FlatList
        data={filteredRatings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ListHeaderComponent={
          tagCounts.length > 0 ? (
            <View style={styles.mentionBlock}>
              <Text style={styles.sectionLabel}>{t.driver.ratings.mentionEyebrow}</Text>
              <View style={styles.mentionWrap}>
                {tagCounts.map(({ tag, count, positive }) => (
                  <View
                    key={tag}
                    style={[styles.mentionChip, { backgroundColor: positive ? colors.accentGreenSoft : colors.dangerSoft }]}
                  >
                    <Text style={[styles.mentionLabel, { color: positive ? colors.accentGreenPressed : colors.dangerPressed }]}>
                      {TAG_LABEL[tag] ?? tag}
                    </Text>
                    <Text style={[styles.mentionCount, { color: positive ? colors.accentGreenPressed : colors.dangerPressed }]}>{count}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? null : ratings.length === 0 ? (
            <EmptyState title={t.driver.ratings.emptyTitle} message={t.driver.ratings.emptyMessage} />
          ) : (
            <Text style={styles.noMatches}>{t.driver.ratings.noMatches}</Text>
          )
        }
        renderItem={({ item }) => {
          const tone = scoreTone(item.stars);
          const lowScore = item.stars <= REPORT_PROMPT_MAX_SCORE;
          // Passenger identity is never shown: ratings are anonymous to the driver.
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <StaticStars value={item.stars} size={14} filled={STAR_COLOR[tone]} empty={colors.line} />
                <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
              </View>
              {item.comment && <Text style={styles.comment}>{item.comment}</Text>}
              {item.tags.length > 0 && (
                <View style={styles.tagRow}>
                  {item.tags.map((tag) => (
                    <View key={tag} style={[styles.tag, { backgroundColor: item.stars >= 4 ? colors.fill : colors.dangerSoft }]}>
                      <Text style={[styles.tagText, { color: item.stars >= 4 ? colors.inkSoft : colors.dangerPressed }]}>
                        {TAG_LABEL[tag] ?? tag}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {lowScore && (
                <Pressable accessibilityRole="button" onPress={() => handleReport(item.rideRequestId)} style={styles.reportFooter}>
                  <Ionicons name="flag-outline" size={14} color={colors.accentBlue} />
                  <Text style={styles.reportText}>{t.driver.ratings.reportUnfair}</Text>
                </Pressable>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}
