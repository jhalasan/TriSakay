import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  // Same shadow recipe as profile.styles.ts's heroShadow.
  heroShadow: {
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 10,
  },
  heroBand: {
    borderBottomLeftRadius: radius.heroBottom,
    borderBottomRightRadius: radius.heroBottom,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  motif: { position: 'absolute', top: -46, right: -52 },
  heroEyebrow: { ...typography.eyebrow, color: colors.white, opacity: 0.75 },
  heroTitle: { ...typography.h1b, color: colors.white, marginTop: 2 },
  filterRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  filterPill: {
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  filterPillActive: { backgroundColor: colors.white, borderColor: colors.white },
  filterPillLabel: { ...typography.bodyStrong, fontSize: 13, color: colors.white },
  filterPillLabelActive: { color: colors.accentBlue },
  offlinePill: { flexDirection: 'row', alignItems: 'center' },
  offlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accentGreen, marginRight: spacing.xs },
  // Matches dashboard.styles.ts's scrollContent — spacing.xl alone isn't
  // tall enough to clear the tab bar (60 + bottom inset), so the last card
  // was clipped behind it.
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.tight44 * 1.7, gap: spacing.md, flexGrow: 1 },
  availableRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.xs },
  availableLabel: { ...typography.label, color: colors.inkSoft },
  availableSummary: { ...typography.caption, fontSize: 12.5, color: colors.inkFaint },
  error: { ...typography.caption, color: colors.danger, paddingHorizontal: spacing.lg },
  offlineIconTile: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
