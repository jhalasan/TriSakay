import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.md,
    minHeight: 64,
  },
  leadingSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textSlot: {
    flex: 1,
    gap: 3,
  },
  title: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  subtitle: {
    ...typography.caption,
    color: colors.inkSoft,
  },
  trailingSlot: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.lineSoft,
  },
});
