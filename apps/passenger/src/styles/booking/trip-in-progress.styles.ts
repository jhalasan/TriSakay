import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statusBadgeWrap: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.lg,
  },
  driverStrip: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  textSlot: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  plate: {
    ...typography.caption,
    color: colors.inkSoft,
  },
});
