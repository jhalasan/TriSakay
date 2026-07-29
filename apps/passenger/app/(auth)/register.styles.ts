import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  avatarUpload: {
    width: 88,
    height: 88,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'dashed',
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  avatarUploadLabel: {
    ...typography.caption,
    color: colors.inkSoft,
    marginTop: spacing.xs,
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
