import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },

  monthRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  monthLabel: {
    ...typography.label,
    color: colors.inkSoft,
  },
  monthTotal: {
    ...typography.bodyStrong,
    fontSize: 13,
    color: colors.ink,
  },

  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
    ...elevation.card,
  },
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textSlot: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  routeText: {
    ...typography.bodyStrong,
    fontSize: 14,
    color: colors.ink,
  },
  dateMethodText: {
    ...typography.caption,
    color: colors.inkSoft,
  },
  trailingSlot: {
    alignItems: 'flex-end',
  },
  fareText: {
    ...typography.bodyStrong,
    fontSize: 15,
    color: colors.ink,
  },
  statusText: {
    ...typography.label,
    fontSize: 10,
    color: colors.accentGreenPressed,
  },
  statusTextRefunded: {
    color: colors.accentBluePressed,
  },
});
