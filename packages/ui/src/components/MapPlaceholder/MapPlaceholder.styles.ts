import { StyleSheet } from 'react-native';
import { colors, fontFamily, radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: colors.fill,
    borderRadius: radius.md,
  },
  labelChip: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -16,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  labelText: {
    ...typography.caption,
    color: colors.inkSoft,
    fontFamily: fontFamily.semibold,
  },
});
