import { View } from 'react-native';
import type { ComplaintDbStatus } from '@trisakay/services';
import { getStageBarColors } from '../../utils/complaintStatus';
import { styles } from './StageBar.styles';

export interface StageBarProps {
  status: ComplaintDbStatus;
}

/** 3-segment progress bar used on case list cards (README §1.3). */
export function StageBar({ status }: StageBarProps) {
  const { segment1, segment2, segment3 } = getStageBarColors(status);
  return (
    <View style={styles.row}>
      <View style={[styles.segment, { backgroundColor: segment1 }]} />
      <View style={[styles.segment, { backgroundColor: segment2 }]} />
      <View style={[styles.segment, { backgroundColor: segment3 }]} />
    </View>
  );
}
