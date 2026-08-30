import { Text, View } from 'react-native';
import { Avatar, Badge, Card, StarRating } from '@trisakay/ui';
import type { Driver } from '../../types/driver';
import { styles } from './DriverInfoCard.styles';

export interface DriverInfoCardProps {
  driver: Driver;
}

/**
 * Every field here is backend-supplied, so each renders a placeholder when it is
 * missing rather than a default. Rating in particular is hidden rather than
 * shown as zero — no stars reads as "unknown", zero stars reads as "terrible".
 */
export function DriverInfoCard({ driver }: DriverInfoCardProps) {
  return (
    <Card variant="raised" style={styles.card}>
      <View style={styles.topRow}>
        <Avatar
          name={driver.name}
          source={driver.avatarUrl ? { uri: driver.avatarUrl } : undefined}
          size="lg"
        />
        <View style={styles.textSlot}>
          <Text style={styles.name}>{driver.name || 'Driver assigned'}</Text>
          {driver.rating !== null && <StarRating value={Math.round(driver.rating)} size={16} />}
        </View>
        {driver.etaMinutes !== null && <Badge label={`ETA ${driver.etaMinutes} min`} tone="blue" />}
      </View>
      <View style={styles.plateRow}>
        <Text style={styles.plateLabel}>Tricycle / Plate</Text>
        <Text style={styles.plateValue}>{driver.plateNumber || '—'}</Text>
      </View>
    </Card>
  );
}
