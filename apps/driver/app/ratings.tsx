import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, colors } from '@trisakay/ui';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { useTranslation } from '../src/hooks/useTranslation';
import { useDriverStore } from '../src/store/useDriverStore';
import { useRatingsStore } from '../src/store/useRatingsStore';
import { interpolate } from '../src/utils/interpolate';
import { styles } from '../src/styles/ratings.styles';

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
  const t = useTranslation();
  const ratings = useRatingsStore((state) => state.ratings);
  const loading = useRatingsStore((state) => state.loading);
  const ratingsError = useRatingsStore((state) => state.error);
  const load = useRatingsStore((state) => state.load);
  const rating = useDriverStore((state) => state.rating);
  const ratingCount = useDriverStore((state) => state.ratingCount);

  useEffect(() => {
    void load();
  }, [load]);

  // Distribution is computed from the ratings actually loaded (most recent 50),
  // so it approximates the true lifetime split rather than reading it exactly.
  const distribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = ratings.filter((item) => item.stars === stars).length;
    return { stars, percent: ratings.length > 0 ? (count / ratings.length) * 100 : 0 };
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={t.driver.ratings.title} />

      {ratingsError && <Text style={styles.error}>{ratingsError}</Text>}

      <FlatList
        data={ratings}
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
