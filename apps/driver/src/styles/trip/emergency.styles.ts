import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dangerSoft, overflow: 'hidden' },
  motif: { position: 'absolute', top: -50, right: -56 },
  content: { flex: 1, padding: spacing.xl, gap: spacing.lg, justifyContent: 'center' },
  iconBadge: {
    width: 70,
    height: 70,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  // 30/36/-0.8 has no matching heading token (nearest is display at 34/40) — a one-off literal, same resolution as the gate screens' titles.
  title: { fontSize: 30, lineHeight: 36, fontFamily: typography.display.fontFamily, letterSpacing: -0.8, color: colors.ink, textAlign: 'center' },
  subtitle: { ...typography.body, fontSize: 14.5, lineHeight: 21, color: colors.inkSoft, textAlign: 'center' },
  dialSection: { marginTop: spacing.xs },
  psoCard: {
    backgroundColor: colors.panel,
    borderRadius: radius.md3,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    ...elevation.card,
  },
  psoIcon: { marginTop: 1 },
  psoTextBlock: { flex: 1 },
  psoStatusText: { ...typography.bodyStrong, fontSize: 14, color: colors.ink },
  psoStatusTime: { ...typography.caption, fontSize: 12.5, color: colors.inkSoft, marginTop: 2 },
  psoStatusTextError: { ...typography.bodyStrong, fontSize: 14, color: colors.danger },
  retryLink: { ...typography.bodyStrong, color: colors.accentBlue, marginTop: spacing.xs },
  backLink: { ...typography.bodyStrong, color: colors.inkSoft, textAlign: 'center', marginTop: spacing.xs },
});
