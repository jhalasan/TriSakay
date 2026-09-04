import { StyleSheet } from 'react-native';
import { colors, elevation, fontFamily, radius, spacing, typography } from '@trisakay/ui';

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
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Shadow lives on this outer wrapper, never on the same view as
  // overflow:'hidden' + borderRadius (see home.styles.ts's heroShadowWrap).
  ordinanceShadowWrap: {
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 26,
    elevation: 8,
  },
  ordinanceCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  ordinanceMotif: {
    position: 'absolute',
    top: -32,
    right: -28,
  },
  ordinanceLabel: {
    ...typography.eyebrow,
    color: colors.white,
    opacity: 0.6,
  },
  ordinanceValue: {
    ...typography.h3,
    fontFamily: fontFamily.bold,
    color: colors.white,
    marginTop: 3,
  },

  card: {
    ...elevation.card,
    gap: spacing.xs,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  ruleLabel: {
    ...typography.body,
    color: colors.inkSoft,
  },
  ruleValue: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  ruleDivider: {
    height: 1,
    backgroundColor: colors.lineSoft,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.inkSoft,
    marginBottom: spacing.xs,
  },
  discountHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  discountIconTile: {
    width: 34,
    height: 34,
    borderRadius: radius.sm2,
    backgroundColor: colors.accentGreenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyText: {
    ...typography.body,
    color: colors.inkSoft,
  },
  discountPercentText: {
    ...typography.bodyStrong,
    color: colors.accentGreenPressed,
  },
  discountLink: {
    ...typography.bodyStrong,
    color: colors.accentBlue,
    marginTop: spacing.sm,
  },
  noticeBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.fill,
    borderRadius: radius.sm2,
    padding: spacing.md,
  },
  noticeIcon: {
    marginTop: 1,
  },
  noticeText: {
    ...typography.caption,
    color: colors.inkSoft,
    flex: 1,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
  },
});
