import { StyleSheet } from 'react-native';
import { spacing } from '@trisakay/ui';

export const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
  },
});
