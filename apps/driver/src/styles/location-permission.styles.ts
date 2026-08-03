import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', backgroundColor: colors.panel, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, ...elevation.card },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...typography.h2, color: colors.ink },
  body: { ...typography.body, color: colors.inkSoft },
  blockedNote: { ...typography.caption, color: colors.danger },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
