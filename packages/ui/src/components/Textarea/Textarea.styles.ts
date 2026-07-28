import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.inkSoft,
  },
  field: {
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    borderRadius: radius.sm,
    backgroundColor: colors.panel,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 120,
  },
  fieldFocused: {
    borderColor: colors.accentBlue,
    borderWidth: 2,
    paddingHorizontal: spacing.md - 0.5,
    paddingVertical: spacing.md - 0.5,
  },
  input: {
    ...typography.body,
    color: colors.ink,
    textAlignVertical: 'top',
    flex: 1,
  },
});
