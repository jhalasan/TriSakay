import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

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
    alignItems: 'center',
    ...elevation.sheet,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h2,
    color: colors.ink,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  blockedNote: {
    ...typography.caption,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
