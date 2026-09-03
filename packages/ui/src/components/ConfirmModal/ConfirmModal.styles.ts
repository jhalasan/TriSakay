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
    borderRadius: radius.xl2,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
    ...elevation.sheet,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h2,
    color: colors.ink,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  message: {
    ...typography.body,
    color: colors.inkSoft,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  actions: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
});
