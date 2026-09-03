import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  stepWrap: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  stepLabel: {
    ...typography.label,
    color: colors.inkSoft,
  },
  stepTrack: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  stepSegment: {
    flex: 1,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.line,
  },
  stepSegmentActive: {
    backgroundColor: colors.accentBlue,
  },
  stepIntro: {
    ...typography.body,
    color: colors.inkSoft,
  },
  version: {
    ...typography.caption,
    color: colors.inkSoft,
  },
  paragraph: {
    ...typography.body,
    color: colors.inkSoft,
  },
  sectionLabel: {
    ...typography.eyebrow,
    color: colors.inkSoft,
    marginTop: spacing.md,
  },
  disclosureCard: {
    padding: 0,
  },
  disclosureRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  disclosureRowDivided: {
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  disclosureTitle: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  disclosureBody: {
    ...typography.caption,
    color: colors.inkSoft,
  },
  /** Slim brand band under the header — echoes login's hero without repeating its full height. */
  heroBand: {
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  motif: {
    position: 'absolute',
    top: -30,
    right: -32,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  /** Step 2 (terms & disclosures) is a legal screen — the system uses a 20px gutter there, not the general 16px. */
  legalScrollContent: {
    paddingHorizontal: 20,
  },
  /**
   * Non-clipping wrapper — the edit badge sits just outside the circle's own
   * bounds. Shadow lives here rather than on `avatarUpload`, which needs
   * `overflow:'hidden'` to clip a chosen photo into the circle — combining a
   * shadow with overflow:'hidden' on the same view bleeds an unclipped
   * rectangle past the rounded corners on Android (same caveat as
   * home.styles.ts's heroShadowWrap).
   */
  avatarWrap: {
    alignSelf: 'center',
    marginBottom: spacing.sm,
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 4,
  },
  avatarUpload: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'dashed',
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  /** Once a photo is picked, the dashed placeholder border is pointless — the image fills the circle instead. */
  avatarUploadFilled: {
    borderWidth: 0,
    borderStyle: 'solid',
    backgroundColor: colors.panel,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentGreen,
    borderWidth: 2.5,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarUploadLabel: {
    ...typography.caption,
    color: colors.inkSoft,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  fields: {
    gap: spacing.md,
  },
  authError: {
    ...typography.caption,
    color: colors.danger,
  },
});
