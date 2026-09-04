import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
  },
  /** The standalone bar — its own background and shadow, for sitting directly over map tiles. */
  barFloating: {
    paddingHorizontal: spacing.sm,
    borderRadius: radius.card,
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
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentBlueSoft,
  },
  contentSlot: {
    flex: 1,
  },
  contentSlotDivided: {
    borderLeftWidth: 1,
    borderLeftColor: colors.lineSoft,
    paddingLeft: spacing.sm,
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
