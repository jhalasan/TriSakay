import { Text, View } from 'react-native';
import { Avatar, Badge, Button, Card } from '@trisakay/ui';
import type { PendingRequest } from '../../types/request';
import { styles } from './RequestCard.styles';

export interface RequestCardProps {
  request: PendingRequest;
  onAccept: () => void;
  onDecline: () => void;
}

export function RequestCard({ request, onAccept, onDecline }: RequestCardProps) {
  const seatsLabel = `${request.seats} seat${request.seats > 1 ? 's' : ''}`;
  const routeLabel =
    request.pickupLabel && request.dropoffLabel
      ? `${request.pickupLabel} → ${request.dropoffLabel}`
      : 'New ride request';

  return (
    <Card style={styles.card}>
      <View style={styles.topRow}>
        <Avatar size="md" />
        <Text style={styles.route} numberOfLines={1}>
          {routeLabel}
        </Text>
        <Badge label={seatsLabel} tone="blue" />
      </View>
      <View style={styles.actions}>
        <View style={styles.actionButton}>
          <Button label="Decline" variant="outline" tone="neutral" size="sm" fullWidth onPress={onDecline} />
        </View>
        <View style={styles.actionButton}>
          <Button label="Accept" size="sm" fullWidth onPress={onAccept} />
        </View>
      </View>
    </Card>
  );
}
