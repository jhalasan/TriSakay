import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  card: {
    flexBasis: '48%',
    gap: spacing.xs,
  },
  label: {
    ...typography.label,
    color: colors.inkSoft,
  },
  value: {
    ...typography.h2,
    color: colors.ink,
  },
});
