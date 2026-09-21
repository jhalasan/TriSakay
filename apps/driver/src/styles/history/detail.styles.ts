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
