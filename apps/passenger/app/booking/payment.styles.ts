import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.xxl,
  },
  /** Mirrors the estimated-fare surface on Confirm so money reads the same. */
  amountCard: {
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accentBlueSoft,
    borderColor: 'transparent',
    paddingVertical: spacing.xl,
    borderRadius: radius.lg,
  },
  amountLabel: {
    ...typography.label,
    color: colors.accentBluePressed,
  },
  amountValue: {
    ...typography.amount,
    color: colors.ink,
  },
  amountNote: {
    ...typography.caption,
    color: colors.inkSoft,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.inkSoft,
    marginBottom: spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.panel,
    minHeight: 72,
  },
  optionRowSelected: {
    borderColor: colors.accentBlue,
    backgroundColor: colors.accentBlueSoft,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.accentBlue,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accentBlue,
  },
  optionTextSlot: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  optionSubtitle: {
    ...typography.caption,
    color: colors.inkSoft,
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    backgroundColor: colors.panel,
  },
});
