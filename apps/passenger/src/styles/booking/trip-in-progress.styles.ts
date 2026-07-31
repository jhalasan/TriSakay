import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

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
    // A floating panel over the map — matches the raised weight carried
    // through finding-driver/driver-found for the same flow.
    ...elevation.sheet,
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
