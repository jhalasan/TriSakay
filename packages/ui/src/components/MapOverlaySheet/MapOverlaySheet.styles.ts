import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing } from '../../theme';

export const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.panel,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    ...elevation.sheet,
  },
  /** Same brand-gradient handle carried through every map screen's sheet. */
  handle: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: 'center',
  },
});
