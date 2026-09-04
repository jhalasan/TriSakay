import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  button: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
  },
  buttonIncrease: {
    borderWidth: 0,
    backgroundColor: colors.accentBlue,
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buttonGlyph: {
    ...typography.h3b,
    color: colors.ink,
    lineHeight: 22,
  },
  buttonGlyphIncrease: {
    color: colors.white,
  },
  value: {
    ...typography.h3b,
    color: colors.ink,
    minWidth: 24,
    textAlign: 'center',
  },
});
