import { useEffect } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, StarRating } from '@trisakay/ui';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { useTranslation } from '../src/hooks/useTranslation';
import { useRatingsStore } from '../src/store/useRatingsStore';
import { styles } from '../src/styles/ratings.styles';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function RatingsScreen() {
  const t = useTranslation();
  const ratings = useRatingsStore((state) => state.ratings);
  const loading = useRatingsStore((state) => state.loading);
  const ratingsError = useRatingsStore((state) => state.error);
  const load = useRatingsStore((state) => state.load);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={t.driver.ratings.title} />

      {ratingsError && <Text style={styles.error}>{ratingsError}</Text>}

      <FlatList
        data={ratings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ListEmptyComponent={
          loading ? null : <EmptyState title={t.driver.ratings.emptyTitle} message={t.driver.ratings.emptyMessage} />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <StarRating value={item.stars} size={16} />
              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
            </View>
            {item.comment && <Text style={styles.comment}>{item.comment}</Text>}
          </View>
        )}
      />
    </SafeAreaView>
  );
}
