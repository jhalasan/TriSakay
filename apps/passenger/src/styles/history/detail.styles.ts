import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },

  summaryCard: {
    gap: spacing.xs,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateTimeText: {
    ...typography.caption,
    color: colors.inkFaint,
  },
  fareText: {
    ...typography.h1,
    color: colors.ink,
  },
  discountText: {
    ...typography.caption,
    color: colors.accentGreen,
  },

  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.inkSoft,
  },

  routeBlock: {
    gap: 2,
  },
  routeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  routeMarkerCol: {
    alignItems: 'center',
    width: 10,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  routeDotPickup: {
    backgroundColor: colors.accentBlue,
  },
  routeDotDropoff: {
    backgroundColor: colors.accentGreen,
  },
  routeLine: {
    flex: 1,
    minHeight: spacing.lg,
    width: 2,
    backgroundColor: colors.line,
    marginVertical: 2,
  },
  routeTextCol: {
    flex: 1,
    paddingBottom: spacing.sm,
  },
  routeLabel: {
    ...typography.label,
    fontSize: 10,
    color: colors.inkFaint,
  },
  routeAddress: {
    ...typography.body,
    color: colors.ink,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  distanceText: {
    ...typography.caption,
    color: colors.inkSoft,
  },

  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  driverName: {
    ...typography.bodyStrong,
    color: colors.ink,
  },

  paymentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },

  cancelReasonText: {
    ...typography.body,
    color: colors.ink,
  },
});
