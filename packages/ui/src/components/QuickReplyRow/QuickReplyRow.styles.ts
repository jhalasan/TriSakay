import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  // RN's ScrollView defaults to flexGrow: 1, which in a column parent (the
  // chat screens' KeyboardAvoidingView) stretches this row to fill leftover
  // vertical space instead of hugging its chips.
  scroll: { flexGrow: 0, flexShrink: 0 },
  content: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.tight6, paddingBottom: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipMd: { minHeight: 36, paddingHorizontal: spacing.tight14 },
  chipLg: { minHeight: 44, paddingHorizontal: 15 },
  chipDisabled: { opacity: 0.5 },
  chipText: { ...typography.bodyStrong, fontSize: 13.5, lineHeight: 18, color: colors.ink },
  chipTextLg: { fontSize: 14.5, lineHeight: 19 },
});
