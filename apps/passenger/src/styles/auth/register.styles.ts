import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  /** Slim brand band under the header — echoes login's hero without repeating its full height. */
  heroBand: {
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  motif: {
    position: 'absolute',
    top: -40,
    left: -40,
  },
  markBadge: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.card,
  },
  mark: {
    width: 36,
    height: 42,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  /** Non-clipping wrapper — the edit badge sits just outside the circle's own bounds. */
  avatarWrap: {
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  avatarUpload: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'dashed',
    backgroundColor: colors.fill,
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
    backgroundColor: colors.accentBlue,
    borderWidth: 2,
    borderColor: colors.white,
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
  legalText: {
    ...typography.caption,
    color: colors.inkSoft,
    textAlign: 'center',
  },
});
