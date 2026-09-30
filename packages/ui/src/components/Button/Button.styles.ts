import { StyleSheet } from 'react-native';
import { radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm2,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  md: {
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    minHeight: 54,
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
    // Lets the label shrink when the button is narrower than its text.
    flexShrink: 1,
    maxWidth: '100%',
  },
  label: {
    flexShrink: 1,
    textAlign: 'center',
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
