import { StyleSheet } from 'react-native';
import { colors, spacing } from '@trisakay/ui';

export const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.panel,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
