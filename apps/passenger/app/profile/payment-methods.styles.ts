import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  note: {
    ...typography.caption,
    color: colors.inkSoft,
    marginTop: spacing.md,
  },
});
