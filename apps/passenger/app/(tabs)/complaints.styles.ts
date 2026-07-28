import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.inkSoft,
  },
  pickerField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.lineStrong, // behaves as a select input
    borderRadius: radius.sm,
    backgroundColor: colors.panel,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  pickerFieldText: {
    ...typography.body,
    color: colors.ink,
  },
  pickerFieldPlaceholder: {
    color: colors.inkFaint,
  },
  pickerList: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
});
