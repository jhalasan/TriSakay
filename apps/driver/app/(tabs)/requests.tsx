import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, colors, EmptyState, RequestCard } from '@trisakay/ui';
import { useAcceptRideRequest } from '../../src/hooks/useAcceptRideRequest';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useDriverStore } from '../../src/store/useDriverStore';
import { useRequestsStore } from '../../src/store/useRequestsStore';
import { styles } from '../../src/styles/tabs/requests.styles';

export default function RequestsScreen() {
  const router = useRouter();
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
          isAvailable ? (
            <EmptyState title={t.driver.requests.noRequestsTitle} message={t.driver.requests.noRequestsMessage} />
          ) : (
            <EmptyState
              icon={
                <View style={styles.offlineIconTile}>
                  <Ionicons name="list-outline" size={32} color={colors.lineStrong} />
                </View>
              }
              title={t.driver.requests.offlineTitle}
              message={t.driver.requests.offlineMessage}
              action={
                <Button
                  label={t.driver.requests.goToDashboard}
                  icon={<Ionicons name="arrow-forward" size={16} color={colors.white} />}
                  onPress={() => router.push('/(tabs)/dashboard')}
                />
              }
            />
          )
        }
        renderItem={({ item }) => (
          <RequestCard
            request={item}
            variant="incoming"
            accepting={acceptingId === item.id}
            onAccept={() => acceptRideRequest(item.id)}
            onDecline={() => decline(item.id)}
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
        )}
      />
    </SafeAreaView>
  );
}
