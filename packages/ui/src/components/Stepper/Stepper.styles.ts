import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buttonGlyph: {
    ...typography.h2,
    color: colors.ink,
    lineHeight: 26,
  },
  value: {
    ...typography.h2,
    color: colors.ink,
    minWidth: 40,
    textAlign: 'center',
  },
});
