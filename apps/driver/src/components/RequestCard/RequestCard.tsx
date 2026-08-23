import { Text, View } from 'react-native';
import { Avatar, Badge, Button, Card } from '@trisakay/ui';
import { useTranslation } from '../../hooks/useTranslation';
import type { PendingRequest } from '../../types/request';
import { styles } from './RequestCard.styles';

export interface RequestCardProps {
  request: PendingRequest;
  onAccept: () => void;
  onDecline: () => void;
  /** True while this specific request is mid-accept — disables both buttons and spins Accept. */
  accepting?: boolean;
}

export function RequestCard({ request, onAccept, onDecline, accepting = false }: RequestCardProps) {
  const t = useTranslation();
  const seatsLabel = `${request.seats} ${request.seats > 1 ? t.driver.requestCard.seatsPlural : t.driver.requestCard.seatsSingular}`;
  const routeLabel =
    request.pickupLabel && request.dropoffLabel
      ? `${request.pickupLabel} → ${request.dropoffLabel}`
      : t.driver.requestCard.newRideRequest;

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
          <Button
            label={t.driver.requestCard.decline}
            variant="outline"
            tone="neutral"
            size="sm"
            fullWidth
            disabled={accepting}
            onPress={onDecline}
          />
        </View>
        <View style={styles.actionButton}>
          <Button
            label={t.driver.requestCard.accept}
            size="sm"
            fullWidth
            disabled={accepting}
            loading={accepting}
            onPress={onAccept}
          />
        </View>
      </View>
    </Card>
  );
}
