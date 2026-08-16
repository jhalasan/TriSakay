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
    marginBottom: spacing.lg,
  },
  authError: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  notice: {
    ...typography.caption,
    color: colors.inkSoft,
    marginBottom: spacing.md,
  },
});
