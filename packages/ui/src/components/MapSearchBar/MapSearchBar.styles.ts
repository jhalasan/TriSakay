import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
  },
  /** The standalone pill — its own background and shadow, for sitting directly over map tiles. */
  barFloating: {
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.panel,
    ...elevation.card,
  },
  /** No background/shadow of its own — for embedding inside another surface that already guarantees contrast. */
  barFlat: {
    paddingHorizontal: 0,
  },
  barDisabled: {
    opacity: 0.6,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentSlot: {
    flex: 1,
  },
  labelPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  label: {
    ...typography.body,
    color: colors.inkSoft,
    flexShrink: 1,
  },
  trailingSlot: {
    marginRight: spacing.xs,
  },
});
