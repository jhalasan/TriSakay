import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    padding: spacing.md,
    gap: spacing.xs,
  },
  bare: {
    flex: 1,
    gap: spacing.xs,
  },
  label: {
    ...typography.labelXs,
    color: colors.inkSoft,
  },
  labelOnNavy: {
    color: colors.white,
    opacity: 0.6,
  },
  value: {
    ...typography.bodyLg,
    color: colors.ink,
  },
  valueOnNavy: {
    color: colors.white,
  },
});
