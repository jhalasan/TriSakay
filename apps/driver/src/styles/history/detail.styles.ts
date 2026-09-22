import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },

  // Summary is a floating inset card (radius 22), not the edge-to-edge
  // header band — shadow lives on the outer wrap per the Android caveat.
  summaryShadowWrap: {
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 26,
    elevation: 8,
  },
  summaryCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.lg2,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  summaryMotif: {
    position: 'absolute',
    top: -34,
    right: -30,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateTimeText: {
    ...typography.caption,
    color: colors.white,
    opacity: 0.72,
  },
  fareEyebrow: {
    ...typography.eyebrow,
    color: colors.white,
    opacity: 0.6,
    marginTop: spacing.md,
  },
  fareText: {
    ...typography.amount,
    color: colors.white,
  },

  section: {
    gap: spacing.sm,
    borderRadius: radius.md3,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.inkSoft,
  },

  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  passengerName: {
    ...typography.bodyStrong,
    color: colors.ink,
  },

  routeBlock: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  routeMarkerCol: {
    alignItems: 'center',
    width: 10,
    paddingTop: 3,
  },
  routeDotPickup: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2.5,
    borderColor: colors.accentGreen,
  },
  routeDotDropoff: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: colors.accentBlue,
  },
  routeLine: {
    flex: 1,
    minHeight: spacing.xl,
    width: 2,
    backgroundColor: colors.line,
    marginVertical: 3,
  },
  routeTextCol: {
    flex: 1,
    gap: spacing.md,
  },
  routeLabel: {
    ...typography.label,
    fontSize: 10,
    color: colors.inkFaint,
  },
  routeAddress: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  distanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  distanceText: {
    ...typography.bodyStrong,
    fontSize: 13,
    color: colors.inkSoft,
  },

  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentMethodLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  paymentMethodText: {
    ...typography.body,
    color: colors.inkSoft,
  },

  cancelReasonText: {
    ...typography.body,
    color: colors.ink,
  },

  referenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  referenceLabel: {
    ...typography.body,
    color: colors.inkSoft,
  },
  referenceValue: {
    ...typography.bodySm,
    color: colors.ink,
  },
});
