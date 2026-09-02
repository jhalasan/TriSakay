import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  textSlot: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    paddingTop: spacing.md,
  },
  statCell: {
    flex: 1,
    gap: 2,
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.lineSoft,
    marginHorizontal: spacing.md,
  },
  statLabel: {
    ...typography.label,
    color: colors.inkSoft,
  },
  statValue: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
});
