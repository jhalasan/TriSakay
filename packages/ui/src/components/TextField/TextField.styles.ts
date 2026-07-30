import { StyleSheet } from 'react-native';
import { colors, fontFamily, radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.inkSoft,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    borderRadius: radius.sm,
    backgroundColor: colors.panel,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  fieldRowFocused: {
    borderColor: colors.accentBlue,
    borderWidth: 2,
    paddingHorizontal: spacing.md - 0.5,
  },
  fieldRowError: {
    borderColor: colors.danger,
    borderWidth: 2,
    paddingHorizontal: spacing.md - 0.5,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.ink,
    paddingVertical: spacing.md,
  },
  iconSlot: {
    marginRight: spacing.sm,
  },
  helperText: {
    ...typography.caption,
    color: colors.inkSoft,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    fontFamily: fontFamily.semibold,
  },
});
