import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },

  // Shadow lives on this outer wrapper, never on the same view as
  // overflow:'hidden' + borderRadius (see home.styles.ts's heroShadowWrap).
  amountShadowWrap: {
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 26,
    elevation: 8,
  },
  amountCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.lg2,
    padding: spacing.lg,
  },
  amountMotif: {
    position: 'absolute',
    top: -34,
    right: -30,
  },
  amountLabel: {
    ...typography.eyebrow,
    color: colors.white,
    opacity: 0.6,
  },
  amountValue: {
    ...typography.amount,
    color: colors.white,
  },
  amountNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.16)',
  },
  amountNote: {
    ...typography.caption,
    color: colors.white,
    opacity: 0.78,
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
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.panel,
    minHeight: 72,
  },
  optionRowSelected: {
    borderWidth: 1.5,
    borderColor: colors.accentBlue,
    ...elevation.card,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.accentBlue,
  },
  radioInner: {
    width: 11,
    height: 11,
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

  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accentBlueSoft,
    borderRadius: radius.sm2,
    padding: spacing.md,
  },
  noticeText: {
    ...typography.caption,
    color: colors.accentBluePressed,
    flex: 1,
  },

  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    backgroundColor: colors.panel,
  },
  gcashStatusText: {
    ...typography.caption,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  gcashErrorBox: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.accentBlueSoft,
    gap: spacing.md,
  },
  gcashErrorText: {
    ...typography.body,
    color: colors.ink,
  },
  gcashErrorActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
