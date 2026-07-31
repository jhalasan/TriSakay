import { StyleSheet } from 'react-native';
import { colors, elevation, fontFamily, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  /** Fixed top band, outside the scroller — the badge below overlaps its bottom edge. */
  heroBand: {
    height: 156,
  },
  motif: {
    position: 'absolute',
    top: -60,
    right: -60,
  },
  /** Pulled up over the hero/body boundary so the mark reads as a floating badge. */
  badgeWrap: {
    alignItems: 'center',
    marginTop: -48,
    marginBottom: spacing.lg,
  },
  markBadge: {
    width: 96,
    height: 96,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.card,
  },
  mark: {
    width: 56,
    height: 66,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  title: {
    ...typography.display,
    color: colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xxl,
  },
  fields: {
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  forgotLinkText: {
    ...typography.caption,
    color: colors.accentBlue,
    fontFamily: fontFamily.bold,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.line,
  },
  dividerText: {
    ...typography.label,
    color: colors.inkSoft, // sits on bg, needs 4.5:1 — inkFaint only clears it on panel
  },
  authError: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.md,
  },
});
