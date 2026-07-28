import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  markText: {
    ...typography.h2,
    color: colors.white,
  },
  title: {
    ...typography.display,
    color: colors.ink,
  },
  subtitle: {
    ...typography.body,
    color: colors.inkSoft,
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
    fontWeight: '700',
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
});
