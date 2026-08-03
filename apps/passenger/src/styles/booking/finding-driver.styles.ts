import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.fill,
  },
  mapFill: {
    flex: 1,
  },
  beaconWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    ...elevation.sheet,
  },
  title: {
    ...typography.h1,
    color: colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  cancelButton: {
    alignSelf: 'stretch',
  },
  cancelError: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
