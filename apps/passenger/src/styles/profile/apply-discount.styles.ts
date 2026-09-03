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
    gap: spacing.lg,
  },

  // Shadow lives on this wrapper, never on the same view as overflow:'hidden'
  // + borderRadius (see home.styles.ts's heroShadowWrap).
  bannerShadowWrap: {
    ...elevation.card,
  },
  banner: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  bannerMotif: {
    position: 'absolute',
    top: -30,
    right: -26,
  },
  bannerIconTile: {
    width: 46,
    height: 46,
    borderRadius: radius.sm2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTextSlot: {
    flex: 1,
    gap: 2,
  },
  bannerTitle: {
    ...typography.h3,
    fontFamily: fontFamily.bold,
    color: colors.white,
  },
  bannerSubtitle: {
    ...typography.caption,
    color: colors.white,
    opacity: 0.85,
  },

  intro: {
    ...typography.body,
    color: colors.inkSoft,
  },
  statusCard: {
    gap: spacing.xs,
  },
  statusTitle: {
    ...typography.h2,
    color: colors.ink,
  },
  statusNote: {
    ...typography.body,
    color: colors.inkSoft,
  },
  remarksLabel: {
    ...typography.label,
    color: colors.inkSoft,
    marginTop: spacing.sm,
  },
  remarksBody: {
    ...typography.body,
    color: colors.ink,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.inkSoft,
    marginBottom: spacing.sm,
  },

  idSlotsWrap: {
    gap: spacing.md,
  },
  idSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 130,
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
  },
  idSlotEmpty: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
  },
  idSlotFilled: {
    backgroundColor: colors.accentBlueSoft,
    borderWidth: 1.5,
    borderColor: colors.accentBlue,
  },
  idSlotTextSlot: {
    flex: 1,
    gap: 2,
  },
  idSlotTitle: {
    ...typography.bodySm,
    color: colors.ink,
  },
  idSlotTitleFilled: {
    color: colors.accentBluePressed,
  },
  idSlotSubtitle: {
    ...typography.caption,
    color: colors.inkSoft,
  },
  idSlotSubtitleFilled: {
    color: colors.accentBlue,
    opacity: 0.75,
  },
  idSlotCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accentGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },

  formError: {
    ...typography.caption,
    color: colors.danger,
  },
  disclaimer: {
    ...typography.caption,
    color: colors.inkFaint,
    textAlign: 'center',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    ...elevation.card,
  },
});
