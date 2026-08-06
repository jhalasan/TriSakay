import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Badge, Toggle, colors } from '@trisakay/ui';
import { RequestCard } from '../../src/components/RequestCard';
import { StatTile } from '../../src/components/StatTile';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useDriverStore } from '../../src/store/useDriverStore';
import { useNotificationsStore } from '../../src/store/useNotificationsStore';
import { useRequestsStore } from '../../src/store/useRequestsStore';
import { useTripStore } from '../../src/store/useTripStore';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/tabs/dashboard.styles';

export default function DashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const isAvailable = useDriverStore((state) => state.isAvailable);
  const setAvailable = useDriverStore((state) => state.setAvailable);
  const availabilityError = useDriverStore((state) => state.error);
  const todayEarnings = useDriverStore((state) => state.todayEarnings);
  const todayTrips = useDriverStore((state) => state.todayTrips);
  const rating = useDriverStore((state) => state.rating);
  const ratingCount = useDriverStore((state) => state.ratingCount);
  const acceptRate = useDriverStore((state) => state.acceptRate);

  const [togglingAvailability, setTogglingAvailability] = useState(false);

  const unreadCount = useNotificationsStore((state) => state.items.filter((item) => !item.read).length);

  const pending = useRequestsStore((state) => state.pending);
  const requestError = useRequestsStore((state) => state.error);
  const subscribe = useRequestsStore((state) => state.subscribe);
  const unsubscribe = useRequestsStore((state) => state.unsubscribe);
  const accept = useRequestsStore((state) => state.accept);
  const decline = useRequestsStore((state) => state.decline);

  const startTrip = useTripStore((state) => state.startTrip);

  async function handleToggleAvailable(next: boolean) {
    setTogglingAvailability(true);

    let coords: { lat: number; lng: number } | undefined;
    if (next) {
      try {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        coords = { lat: position.coords.latitude, lng: position.coords.longitude };
      } catch {
        useDriverStore.setState({ error: 'Could not get your location. Make sure location services are turned on.' });
        setTogglingAvailability(false);
        return;
      }
    }

    const ok = await setAvailable(next, coords);
    setTogglingAvailability(false);
    if (!ok) return;

    if (next && user) {
      subscribe(user.id);
    } else {
      unsubscribe();
    }
  }

  async function handleAccept(id: string) {
    if (useTripStore.getState().current) {
      router.push('/trip/active');
      return;
    }
    if (!user) return;
    const accepted = await accept(id, user.id);
    if (accepted) {
      startTrip(accepted, accepted.tripId);
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            style={styles.bellButton}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.ink} />
            {unreadCount > 0 && <View style={styles.bellDot} />}
          </Pressable>
          <Toggle value={isAvailable} onValueChange={handleToggleAvailable} disabled={togglingAvailability} />
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>{isAvailable ? 'You are online' : 'You are offline'}</Text>
          <Badge label={isAvailable ? 'Online' : 'Offline'} tone={isAvailable ? 'green' : 'neutral'} dot />
        </View>

        {availabilityError && <Text style={styles.error}>{availabilityError}</Text>}

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

        {requestError && <Text style={styles.error}>{requestError}</Text>}

        {isAvailable && !incoming && (
          <Text style={styles.offlineNote}>Listening for ride requests…</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
