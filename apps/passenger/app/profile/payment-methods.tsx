import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Badge, Card, ListRow } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { styles } from '../../src/styles/profile/payment-methods.styles';

export default function PaymentMethodsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ScreenHeader title="Payment methods" />
      <View style={styles.content}>
        <Card>
          <ListRow
            title="GCash"
            subtitle="Linked at checkout, not saved"
            trailing={<Badge label="Available" tone="green" />}
          />
          <ListRow title="Cash" subtitle="Pay your driver directly" trailing={<Badge label="Available" tone="green" />} divider={false} />
        </Card>
        <Card>
          <ListRow
            title="Payment history"
            onPress={() => router.push('/profile/payment-history')}
            chevron
            divider={false}
          />
        </Card>
        <Text style={styles.note}>Saving a GCash account or card isn't available in this preview.</Text>
      </View>
    </View>
  );
}
