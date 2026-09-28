import { Text, View } from 'react-native';
import type { ComplaintDbStatus } from '@trisakay/services';
import { STATUS_CHIP_TONE } from '../../utils/complaintStatus';
import { styles } from './StatusChip.styles';

export interface StatusChipProps {
  status: ComplaintDbStatus;
  label: string;
}

export function StatusChip({ status, label }: StatusChipProps) {
  const tone = STATUS_CHIP_TONE[status];
  return (
    <View style={[styles.chip, { backgroundColor: tone.bg }]}>
      <Text style={[styles.label, { color: tone.fg }]}>{label}</Text>
    </View>
  );
}
