import { StyleSheet } from 'react-native';
import { colors, fontFamily, radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  container: {
    gap: 7, // literal — spec calls out 7px label-to-field gap specifically, no matching spacing token
  },
  label: {
    ...typography.label,
    color: colors.inkSoft,
  },
  // Border width is fixed across every state (resting/focused/error) — only
  // borderColor changes. An RN TextInput on Android can lose focus the
  // instant its wrapping View's box dimensions change out from under it
  // (padding/border-width shifts included, not just elevation), so nothing
  // here is allowed to resize on focus, only recolor.
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.panel,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  fieldRowFocused: {
    borderColor: colors.accentBlue,
  },
  fieldRowError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.ink,
    paddingVertical: spacing.tight14,
  },
  iconSlot: {
    marginRight: spacing.sm,
  },
  revealButton: {
    marginLeft: spacing.sm,
  },
  helperText: {
    ...typography.caption,
    color: colors.inkSoft,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    fontFamily: fontFamily.semibold,
    marginTop: -1, // container gap already gives 7px; spec wants the message 6px below the field
  },
});
