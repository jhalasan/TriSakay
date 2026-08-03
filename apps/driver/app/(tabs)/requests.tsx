import { useRouter } from 'expo-router';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, EmptyState } from '@trisakay/ui';
import { RequestCard } from '../../src/components/RequestCard';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useDriverStore } from '../../src/store/useDriverStore';
import { useRequestsStore } from '../../src/store/useRequestsStore';
import { useTripStore } from '../../src/store/useTripStore';
import { styles } from '../../src/styles/tabs/requests.styles';

export default function RequestsScreen() {
  const router = useRouter();
  const isAvailable = useDriverStore((state) => state.isAvailable);
  const user = useAuthStore((state) => state.user);
  const pending = useRequestsStore((state) => state.pending);
  const requestError = useRequestsStore((state) => state.error);
  const accept = useRequestsStore((state) => state.accept);
  const decline = useRequestsStore((state) => state.decline);
  const startTrip = useTripStore((state) => state.startTrip);

  async function handleAccept(id: string) {
    if (useTripStore.getState().current) {
      router.push('/trip/active');
      return;
    }
    if (!user) return;
    const request = await accept(id, user.id);
    if (request) {
      startTrip(request);
      router.push('/trip/active');
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Ride requests</Text>
        {isAvailable && <Badge label="Along route" tone="blue" />}
      </View>

      {requestError && <Text style={styles.error}>{requestError}</Text>}

      <FlatList
        data={pending}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            title={isAvailable ? 'No requests right now' : "You're offline"}
            message={isAvailable ? 'New ride requests will appear here.' : 'Go online from the Dashboard to start receiving requests.'}
          />
        }
        renderItem={({ item }) => (
          <RequestCard request={item} onAccept={() => handleAccept(item.id)} onDecline={() => decline(item.id)} />
        )}
      />
    </SafeAreaView>
  );
}
