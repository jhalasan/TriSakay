import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  iconTile: {
    width: 52,
    height: 52,
    borderRadius: radius.card,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
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
