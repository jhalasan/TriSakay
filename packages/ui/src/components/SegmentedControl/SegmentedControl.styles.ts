import { StyleSheet } from 'react-native';
import { colors, fontFamily, radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.fill,
    borderRadius: radius.sm2,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.xs,
    minHeight: 36,
  },
  segmentActive: {
    backgroundColor: colors.white,
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 1,
  },
  label: {
    ...typography.caption,
    fontFamily: fontFamily.semibold,
    color: colors.inkFaint,
  },
  labelActive: {
    ...typography.caption,
    fontFamily: fontFamily.bold,
    color: colors.accentBlue,
  },
});
