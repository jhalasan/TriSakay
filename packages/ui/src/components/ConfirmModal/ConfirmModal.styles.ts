import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
    ...elevation.sheet,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: -spacing.xs,
  },
  iconTileDanger: { backgroundColor: colors.dangerSoft },
  iconTileNeutral: { backgroundColor: colors.fill },
  title: {
    ...typography.h2,
    color: colors.ink,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
});
