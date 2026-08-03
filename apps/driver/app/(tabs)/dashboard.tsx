import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Badge, Toggle } from '@trisakay/ui';
import { RequestCard } from '../../src/components/RequestCard';
import { StatTile } from '../../src/components/StatTile';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useDriverStore } from '../../src/store/useDriverStore';
import { useRequestsStore } from '../../src/store/useRequestsStore';
import { useTripStore } from '../../src/store/useTripStore';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/tabs/dashboard.styles';

export default function DashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const isAvailable = useDriverStore((state) => state.isAvailable);
  const setAvailable = useDriverStore((state) => state.setAvailable);
  const todayEarnings = useDriverStore((state) => state.todayEarnings);
  const todayTrips = useDriverStore((state) => state.todayTrips);
  const rating = useDriverStore((state) => state.rating);
  const ratingCount = useDriverStore((state) => state.ratingCount);
  const acceptRate = useDriverStore((state) => state.acceptRate);

  const pending = useRequestsStore((state) => state.pending);
  const startSimulatingArrivals = useRequestsStore((state) => state.startSimulatingArrivals);
  const stopSimulatingArrivals = useRequestsStore((state) => state.stopSimulatingArrivals);
  const accept = useRequestsStore((state) => state.accept);
  const decline = useRequestsStore((state) => state.decline);

  const startTrip = useTripStore((state) => state.startTrip);

  function handleToggleAvailable(next: boolean) {
    setAvailable(next);
    if (next) {
      startSimulatingArrivals();
    } else {
      stopSimulatingArrivals();
    }
  }

  function handleAccept(id: string) {
    const request = accept(id);
    if (request) {
      startTrip(request);
      router.push('/trip/active');
    }
  }

  const incoming = pending[0];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topRow}>
          <Avatar name={user?.name} source={user?.avatarUrl ? { uri: user.avatarUrl } : undefined} size="lg" />
          <View style={styles.nameSlot}>
            <Text style={styles.name} numberOfLines={1}>
              {user?.name ?? 'Driver'}
            </Text>
          </View>
          <Toggle value={isAvailable} onValueChange={handleToggleAvailable} />
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>{isAvailable ? 'You are online' : 'You are offline'}</Text>
          <Badge label={isAvailable ? 'Online' : 'Offline'} tone={isAvailable ? 'green' : 'neutral'} dot />
        </View>

        <View style={styles.statGrid}>
          <StatTile label="Earnings today" value={formatCurrency(todayEarnings)} />
          <StatTile label="Trips today" value={String(todayTrips)} />
          <StatTile label="Rating" value={ratingCount > 0 && rating !== null ? rating.toFixed(1) : '—'} />
          <StatTile label="Accept rate" value={acceptRate !== null ? `${Math.round(acceptRate * 100)}%` : '—'} />
        </View>

        {incoming && (
          <View>
            <Text style={styles.sectionLabel}>Incoming request</Text>
            <RequestCard request={incoming} onAccept={() => handleAccept(incoming.id)} onDecline={() => decline(incoming.id)} />
          </View>
        )}

        {isAvailable && !incoming && (
          <Text style={styles.offlineNote}>Listening for ride requests…</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
