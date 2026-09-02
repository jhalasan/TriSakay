import { Text, View } from 'react-native';
import { Avatar, Badge, Card, StarRating } from '@trisakay/ui';
import type { Driver } from '../../types/driver';
import { formatCurrency } from '../../utils/currency';
import { styles } from './DriverInfoCard.styles';

export interface DriverInfoCardProps {
  driver: Driver;
  /** Trip-level fields, not part of the driver record — both optional so this still renders plate-only before the booking store has them. */
  seats?: number;
  fare?: number | null;
}

/**
 * Every field here is backend-supplied, so each renders a placeholder when it is
 * missing rather than a default. Rating in particular is hidden rather than
 * shown as zero — no stars reads as "unknown", zero stars reads as "terrible".
 */
export function DriverInfoCard({ driver, seats, fare }: DriverInfoCardProps) {
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
      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Plate</Text>
          <Text style={styles.statValue}>{driver.plateNumber || '—'}</Text>
        </View>
        {seats != null && (
          <>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>Seats</Text>
              <Text style={styles.statValue}>{seats}</Text>
            </View>
          </>
        )}
        {fare != null && (
          <>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>Fare</Text>
              <Text style={styles.statValue}>{formatCurrency(fare)}</Text>
            </View>
          </>
        )}
      </View>
    </Card>
  );
}
