import { Text, View } from 'react-native';
import { Card } from '@trisakay/ui';
import { styles } from './StatTile.styles';

export interface StatTileProps {
  label: string;
  value: string;
}

export function StatTile({ label, value }: StatTileProps) {
  return (
    <Card style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </Card>
  );
}
