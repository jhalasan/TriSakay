import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  band: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  bandMotif: {
    position: 'absolute',
    top: -30,
    right: -30,
  },
  iconTile: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  bandTitle: {
    ...typography.h1b,
    color: colors.white,
    textAlign: 'center',
  },
  bandSubtitle: {
    ...typography.caption,
    color: colors.white,
    opacity: 0.85,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  summaryCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  routeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  routeDots: {
    alignItems: 'center',
    paddingTop: 4,
  },
  routeDotPickup: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentBlue,
  },
  routeLine: {
    width: 1,
    flex: 1,
    minHeight: 20,
    backgroundColor: colors.line,
    marginVertical: 4,
  },
  routeDotDropoff: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentGreen,
  },
  routeLabels: {
    flex: 1,
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  routeLabel: {
    ...typography.body,
    color: colors.ink,
  },
  divider: {
    height: 1,
    backgroundColor: colors.lineSoft,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    ...typography.body,
    color: colors.inkSoft,
  },
  summaryValue: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  driverTextSlot: {
    flex: 1,
    minWidth: 0,
  },
  driverName: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  driverPlate: {
    ...typography.caption,
    color: colors.inkSoft,
    marginTop: 2,
  },
  continueWrap: {
    marginTop: 'auto',
    paddingBottom: spacing.xl,
  },
});
