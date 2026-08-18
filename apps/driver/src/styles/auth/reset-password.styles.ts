import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  intro: {
    ...typography.body,
    color: colors.inkSoft,
    marginBottom: spacing.xl,
  },
  fields: {
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  resendLink: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  resendLinkText: {
    ...typography.caption,
    color: colors.accentBlue,
  },
  authError: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  successTitle: {
    ...typography.h2,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  successBody: {
    ...typography.body,
    color: colors.inkSoft,
    marginBottom: spacing.xl,
  },
});
