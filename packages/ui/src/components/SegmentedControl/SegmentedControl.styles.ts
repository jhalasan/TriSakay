import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

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
    alignItems: 'center',
    justifyContent: 'center',
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
    ...typography.chip,
    color: colors.inkFaint,
  },
  labelActive: {
    ...typography.chip,
    color: colors.accentBlue,
  },
});
