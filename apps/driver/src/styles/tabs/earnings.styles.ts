import { StyleSheet } from 'react-native';
import { colors, elevation, fontFamily, radius, spacing, typography } from '@trisakay/ui';

/** Recipe 2 (phase0-notes.md) — bespoke panel shadow matching the README's exact weight, not `elevation.card`. */
const panelShadow = {
  shadowColor: colors.accentBlue,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.07,
  shadowRadius: 8,
  elevation: 2,
};

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.lg, gap: spacing.lg },
  // 26/32/-0.7 has no matching heading token (h1b is closest, at 28/32) — a one-off literal shared by every tab screen's page title.
  title: { fontSize: 26, lineHeight: 32, fontFamily: fontFamily.extrabold, letterSpacing: -0.7, color: colors.ink },
  /** Shadow never sits on the clipped GradientSurface itself — see phase0-notes.md Recipe 1. */
  totalCardShadow: {
    borderRadius: 22,
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
    elevation: 10,
  },
  totalCard: { borderRadius: 22, padding: spacing.lg },
  totalMotif: { position: 'absolute', bottom: -56, right: -44 },
  totalLabel: { ...typography.label, color: colors.white, opacity: 0.6 },
  totalValue: { ...typography.amount, color: colors.white, marginTop: 2 },
  totalStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.16)',
  },
  totalStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  totalStatText: { ...typography.bodySm, color: colors.white },
  sectionLabel: { ...typography.label, color: colors.inkSoft },
  chartPanel: { backgroundColor: colors.panel, borderRadius: radius.lg, padding: spacing.md, ...panelShadow },
  logPanel: { backgroundColor: colors.panel, borderRadius: radius.lg, paddingHorizontal: spacing.lg, ...panelShadow },
  logRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  logRowLast: { borderBottomWidth: 0 },
  logTextSlot: { gap: 2 },
  logAmount: { ...typography.body, color: colors.ink },
  logDate: { ...typography.caption, color: colors.inkSoft },
  caption: { ...typography.label, fontSize: 10, color: colors.inkFaint, textAlign: 'center' },
  error: { ...typography.caption, color: colors.danger },
});
