import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  text: { ...typography.body, fontSize: 13, lineHeight: 18, color: colors.danger, flex: 1 },
  retryButton: { minHeight: 32, paddingHorizontal: 10, borderRadius: radius.sm, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  retryText: { ...typography.bodyStrong, fontSize: 13, color: colors.danger },
});
