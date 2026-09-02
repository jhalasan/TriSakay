import { StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../../theme';

export const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.panel,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  flat: {
    borderWidth: 1,
    borderColor: colors.line,
  },
});
