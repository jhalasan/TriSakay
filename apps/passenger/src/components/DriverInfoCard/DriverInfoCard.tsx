import { Text, View } from 'react-native';
import { Avatar, Badge, Card, StarRating } from '@trisakay/ui';
import type { Driver } from '../../types/driver';
import { styles } from './DriverInfoCard.styles';

export interface DriverInfoCardProps {
  driver: Driver;
}

export function DriverInfoCard({ driver }: DriverInfoCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.topRow}>
        <Avatar name={driver.name} size="lg" />
        <View style={styles.textSlot}>
          <Text style={styles.name}>{driver.name}</Text>
          <StarRating value={Math.round(driver.rating)} size={16} />
        </View>
        <Badge label={`ETA ${driver.etaMinutes} min`} tone="blue" />
      </View>
      <View style={styles.plateRow}>
        <Text style={styles.plateLabel}>Tricycle / Plate</Text>
        <Text style={styles.plateValue}>{driver.plateNumber}</Text>
      </View>
    </Card>
  );
}
