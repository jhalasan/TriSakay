import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  routeCard: {
    gap: spacing.md,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 6,
  },
  routeTextSlot: {
    flex: 1,
    gap: 2,
  },
  routeLabel: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  routeAddress: {
    ...typography.caption,
    color: colors.inkSoft,
  },
  routeDivider: {
    height: 1,
    backgroundColor: colors.lineSoft,
    marginLeft: 6,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    ...typography.label,
    color: colors.inkSoft,
  },
  sectionLabelSpaced: {
    ...typography.label,
    color: colors.inkSoft,
    marginBottom: spacing.md,
  },
  /** The fare is the number the rider is looking for — give it its own surface. */
  fareCard: {
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accentBlueSoft,
    borderColor: 'transparent',
    paddingVertical: spacing.xl,
    borderRadius: radius.lg,
  },
  fareLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  fareLabel: {
    ...typography.label,
    color: colors.accentBluePressed,
  },
  fareValue: {
    ...typography.amount,
    color: colors.ink,
  },
  fareNote: {
    ...typography.caption,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  discountLink: {
    ...typography.caption,
    color: colors.accentBluePressed,
    textDecorationLine: 'underline',
    marginTop: spacing.xs,
  },
  requestError: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    backgroundColor: colors.panel,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.inkSoft,
    textAlign: 'center',
  },
});
