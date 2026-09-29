import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

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
    paddingBottom: spacing.xl,
  },
  // Applied to the inner `<SafeAreaView edges={['top']}>` (not heroBand
  // itself) so the gradient still bleeds edge-to-edge behind the status bar
  // while its content gets both the safe-area inset and this breathing room.
  heroBandInner: { paddingHorizontal: spacing.lg, paddingTop: spacing.xxl },
  motif: { position: 'absolute', top: -46, right: -52 },
  heroEyebrow: { ...typography.eyebrow, color: colors.white, opacity: 0.75 },
  heroTitle: { ...typography.h1b, color: colors.white, marginTop: 2 },
  filterRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  filterPill: {
    borderRadius: radius.pill,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: spacing.tight14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
  },
  filterPillActive: { backgroundColor: colors.white, borderColor: colors.white },
  filterPillLabel: { ...typography.bodyStrong, fontSize: 13, color: colors.white },
  filterPillLabelActive: { color: colors.accentBlue },
  // Matches dashboard.styles.ts's scrollContent — spacing.xl alone isn't
  // tall enough to clear the tab bar (60 + bottom inset), so the last row
  // was clipped behind it.
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.tight44 * 1.7, gap: spacing.lg },
  error: { ...typography.caption, color: colors.danger, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },

  skeletonCard: { height: 120, borderRadius: radius.md3, backgroundColor: '#E4E8EC' },

  // --- day group header ---
  groupHeaderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: spacing.md, gap: spacing.sm },
  groupHeaderLeft: { flexShrink: 1 },
  groupHeaderDay: { fontSize: 13, lineHeight: 18, fontFamily: typography.bodyStrong.fontFamily, color: colors.ink },
  groupHeaderDate: { ...typography.caption, fontSize: 13, color: colors.inkSoft },
  groupHeaderRight: { fontSize: 12.5, lineHeight: 17, fontFamily: typography.bodyStrong.fontFamily, color: colors.inkSoft, flexShrink: 0 },
  groupList: { gap: spacing.sm, marginTop: spacing.sm },

  // --- completed card ---
  completedCard: {
    backgroundColor: colors.panel,
    borderRadius: radius.md3,
    padding: spacing.tight14,
    gap: spacing.md,
    ...elevation.card,
  },
  cardRow1: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardMeta: { fontSize: 12.5, lineHeight: 17, fontFamily: typography.caption.fontFamily, color: colors.inkSoft },
  cardFare: { fontSize: 17, lineHeight: 21, fontFamily: typography.h1b.fontFamily, letterSpacing: -0.3, color: colors.ink },

  routeRow: { flexDirection: 'row', gap: spacing.tight14 },
  routeRail: { alignItems: 'center', width: 10, paddingTop: 3 },
  routeDotPickup: { width: 10, height: 10, borderRadius: 5, borderWidth: 2.5, borderColor: colors.accentBlue },
  routeLine: { flex: 1, width: 2, minHeight: 12, backgroundColor: colors.line, marginVertical: 3 },
  routeDotDropoff: { width: 10, height: 10, borderRadius: 2, backgroundColor: colors.accentGreen },
  routeTextCol: { flex: 1, gap: spacing.sm, minWidth: 0 },
  routeText: { fontSize: 14.5, lineHeight: 20, fontFamily: typography.bodyStrong.fontFamily, color: colors.ink },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  footerInitialsCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accentBlueSoft, alignItems: 'center', justifyContent: 'center' },
  footerInitialsText: { fontSize: 11, lineHeight: 14, fontFamily: typography.h1b.fontFamily, color: colors.accentBluePressed },
  footerName: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: typography.caption.fontFamily, color: colors.ink },
  doneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.accentGreenSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  doneChipText: { fontSize: 10.5, lineHeight: 13, letterSpacing: 0.5, fontFamily: typography.h1b.fontFamily, color: colors.accentGreenPressed },

  // --- cancelled card ---
  cancelledCard: {
    backgroundColor: colors.panel,
    borderRadius: radius.md3,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    padding: spacing.tight14,
    gap: spacing.sm,
  },
  cancelledChip: { backgroundColor: colors.dangerSoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  cancelledChipText: { fontSize: 10.5, lineHeight: 13, letterSpacing: 0.5, fontFamily: typography.h1b.fontFamily, color: colors.danger },
  cancelledRouteText: { fontSize: 14.5, lineHeight: 20, fontFamily: typography.bodyStrong.fontFamily, color: colors.inkSoft },
  reasonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  reasonText: { flex: 1, fontSize: 12.5, lineHeight: 18, fontFamily: typography.caption.fontFamily, color: colors.inkSoft },
});
