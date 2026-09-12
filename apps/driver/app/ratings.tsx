import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMotif, EmptyState, GradientSurface, colors } from '@trisakay/ui';
import { useTranslation } from '../src/hooks/useTranslation';
import { useDriverStore } from '../src/store/useDriverStore';
import { useRatingsStore } from '../src/store/useRatingsStore';
import { interpolate } from '../src/utils/interpolate';
import { styles } from '../src/styles/ratings.styles';

type RatingsFilter = 'all' | 'withComments' | 'low';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Bespoke, not the shared editable `StarRating` (its filled color is navy — this mock's read-only stars are brand green). */
function StaticStars({ value, size }: { value: number; size: number }) {
  return (
    <View style={styles.starsRow}>
      {Array.from({ length: 5 }, (_, i) => (
        <Ionicons key={i} name={i < value ? 'star' : 'star-outline'} size={size} color={i < value ? colors.accentGreen : colors.line} />
      ))}
    </View>
  );
}

export default function RatingsScreen() {
  const router = useRouter();
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

  useEffect(() => {
    void load();
  }, [load]);

  // Distribution is computed from the ratings actually loaded (most recent 50),
  // so it approximates the true lifetime split rather than reading it exactly.
  const distribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = ratings.filter((item) => item.stars === stars).length;
    return { stars, percent: ratings.length > 0 ? (count / ratings.length) * 100 : 0 };
  });

  const filteredRatings = useMemo(() => {
    if (filter === 'withComments') return ratings.filter((item) => Boolean(item.comment));
    if (filter === 'low') return ratings.filter((item) => item.stars <= 2);
    return ratings;
  }, [ratings, filter]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.heroShadow}>
        <GradientSurface token="hero" direction="diagonal" style={styles.heroBand}>
          <BrandMotif size={200} color={colors.white} opacity={0.12} style={styles.motif} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={22} color={colors.white} />
          </Pressable>
          <Text style={styles.heroEyebrow}>{t.driver.ratings.eyebrow}</Text>
          <Text style={styles.heroTitle}>{t.driver.ratings.title}</Text>
          <View style={styles.filterRow}>
            {filterOptions.map((option) => {
              const active = option.value === filter;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setFilter(option.value)}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                >
                  <Text style={[styles.filterPillLabel, active && styles.filterPillLabelActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </GradientSurface>
      </View>

      {ratingsError && <Text style={styles.error}>{ratingsError}</Text>}

      <FlatList
        data={filteredRatings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ListHeaderComponent={
          rating !== null ? (
            <View style={styles.summaryCard}>
              <View style={styles.summaryScoreCol}>
                <Text style={styles.summaryScore}>{rating.toFixed(1)}</Text>
                <StaticStars value={Math.round(rating)} size={13} />
                <Text style={styles.summaryCount}>{interpolate(t.driver.ratings.ratingsCount, { count: ratingCount })}</Text>
              </View>
              <View style={styles.distributionCol}>
                {distribution.map(({ stars, percent }) => (
                  <View key={stars} style={styles.distributionRow}>
                    <Text style={styles.distributionStar}>{stars}</Text>
                    <View style={styles.distributionTrack}>
                      <View style={[styles.distributionFill, { width: `${percent}%` }]} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? null : <EmptyState title={t.driver.ratings.emptyTitle} message={t.driver.ratings.emptyMessage} />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <StaticStars value={item.stars} size={14} />
              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
            </View>
            {item.comment && <Text style={styles.comment}>{item.comment}</Text>}
          </View>
        )}
      />
    </SafeAreaView>
  );
}
