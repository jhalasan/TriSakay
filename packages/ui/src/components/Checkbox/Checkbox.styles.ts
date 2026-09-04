import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowPressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.45,
  },
  /** 24px with a 44px effective target via the row's hitSlop — the box itself
   *  stays small so it reads as a checkbox rather than a button. */
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.lineStrong, // control boundary, not a divider
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  label: {
    ...typography.caption,
    color: colors.ink,
    flex: 1,
  },
});
