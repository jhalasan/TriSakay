import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, EmptyState } from '@trisakay/ui';
import { RequestCard } from '../../src/components/RequestCard';
import { useAcceptRideRequest } from '../../src/hooks/useAcceptRideRequest';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useDriverStore } from '../../src/store/useDriverStore';
import { useRequestsStore } from '../../src/store/useRequestsStore';
import { styles } from '../../src/styles/tabs/requests.styles';

export default function RequestsScreen() {
  const t = useTranslation();
  const isAvailable = useDriverStore((state) => state.isAvailable);
  const pending = useRequestsStore((state) => state.pending);
  const requestError = useRequestsStore((state) => state.error);
  const decline = useRequestsStore((state) => state.decline);
  const { acceptRideRequest, acceptingId } = useAcceptRideRequest();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.driver.requests.title}</Text>
        {isAvailable && <Badge label={t.driver.requests.alongRoute} tone="blue" />}
      </View>

      {requestError && <Text style={styles.error}>{requestError}</Text>}

      <FlatList
        data={pending}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            title={isAvailable ? t.driver.requests.noRequestsTitle : t.driver.requests.offlineTitle}
            message={isAvailable ? t.driver.requests.noRequestsMessage : t.driver.requests.offlineMessage}
          />
        }
        renderItem={({ item }) => (
          <RequestCard
            request={item}
            accepting={acceptingId === item.id}
            onAccept={() => acceptRideRequest(item.id)}
            onDecline={() => decline(item.id)}
          />
        )}
      />
    </SafeAreaView>
  );
}
