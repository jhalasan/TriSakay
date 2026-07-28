import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    padding: 5,
    gap: 5,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    minHeight: 48,
  },
  segmentActive: {
    backgroundColor: colors.accentBlue,
  },
  label: {
    ...typography.bodyStrong,
    color: colors.inkSoft,
  },
  labelActive: {
    color: colors.white,
  },
});
