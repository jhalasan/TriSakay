import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  counter: { ...typography.labelSm, fontSize: 11, lineHeight: 14, color: colors.inkFaint, alignSelf: 'flex-end', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  attachButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  inputWrap: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  inputWrapFocused: { borderWidth: 1.5, borderColor: colors.accentBlue, backgroundColor: colors.white },
  input: { ...typography.body, fontSize: 15, lineHeight: 20, color: colors.ink, paddingVertical: 10 },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentBlue,
  },
  sendButtonDisabled: { backgroundColor: colors.fill },
});
