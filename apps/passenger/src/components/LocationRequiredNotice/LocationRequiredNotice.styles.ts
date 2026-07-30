import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    // The row's own box, plus the 8pt hitSlop on either side, has to clear the
    // 44pt minimum touch target: 18pt of text under 8pt of padding came to 42.
    // Grow the box rather than the hitSlop — a wider hitSlop would reach past
    // the row's top edge into the disabled CTA sitting directly above it.
    minHeight: 30,
  },
  text: {
    ...typography.caption,
    color: colors.danger,
  },
});
