import { StyleSheet } from 'react-native';
import { radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  md: {
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    minHeight: 52,
  },
  sm: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 40,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelMd: {
    ...typography.button,
  },
  labelSm: {
    ...typography.buttonSmall,
  },
  iconSlot: {
    marginRight: spacing.sm,
  },
});
