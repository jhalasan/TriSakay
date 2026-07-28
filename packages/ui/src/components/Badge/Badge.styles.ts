import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
  },
  label: {
    ...typography.label,
    fontSize: 11,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs + 2,
  },
  neutral: { backgroundColor: colors.fill },
  neutralText: { color: colors.inkSoft },
  blue: { backgroundColor: colors.accentBlueSoft },
  blueText: { color: colors.accentBluePressed },
  green: { backgroundColor: colors.accentGreenSoft },
  greenText: { color: colors.accentGreenPressed },
  danger: { backgroundColor: colors.dangerSoft },
  dangerText: { color: colors.dangerPressed },
});
