import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  // Same shadow recipe as history.styles.ts's heroShadow.
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
    paddingBottom: spacing.tight22,
  },
  // Applied to the inner `<SafeAreaView edges={['top']}>` (not heroBand
  // itself) so the gradient still bleeds edge-to-edge behind the status bar
  // while its content gets both the safe-area inset and this breathing room.
  heroBandInner: { paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, gap: spacing.lg },
  motif: { position: 'absolute', top: -46, right: -52 },

  // --- segmented control ---
  segmentRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: radius.pill, padding: 3 },
  segmentItem: { flex: 1, borderRadius: radius.pill, paddingVertical: spacing.sm, alignItems: 'center' },
  segmentItemActive: { backgroundColor: colors.white },
  segmentLabel: { ...typography.bodyStrong, fontSize: 13, color: colors.white },
  segmentLabelActive: { color: colors.accentBlue },

  // --- range / total ---
  rangeEyebrow: { ...typography.eyebrow, color: colors.white, opacity: 0.75, textTransform: 'none', letterSpacing: 0.4 },
  periodTotal: { ...typography.amount, color: colors.white, marginTop: 2 },
  deltaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    backgroundColor: 'rgba(233,247,227,0.16)',
  },
  deltaPillText: { fontSize: 12.5, lineHeight: 16, fontFamily: typography.bodyStrong.fontFamily, color: colors.accentGreenSoft },
  deltaTripCount: { fontSize: 12.5, lineHeight: 16, fontFamily: typography.body.fontFamily, color: colors.accentBlueSoft },

  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.tight44 * 1.7, gap: spacing.lg },
  error: { ...typography.caption, color: colors.danger },

  // --- chart card ---
  chartCard: { backgroundColor: colors.panel, borderRadius: radius.lg2, padding: spacing.lg, gap: spacing.md, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2 },
  chartHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  chartHeaderLabel: { fontSize: 12.5, lineHeight: 17, fontFamily: typography.body.fontFamily, color: colors.inkSoft },
  chartHeaderValue: { fontSize: 22, lineHeight: 27, fontFamily: typography.h1b.fontFamily, letterSpacing: -0.4, color: colors.ink, marginTop: 2 },
  chartHeaderChip: { backgroundColor: colors.accentBlueSoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  chartHeaderChipText: { fontSize: 12, lineHeight: 15, fontFamily: typography.bodyStrong.fontFamily, color: colors.accentBlue },

  barsRow: { flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: spacing.sm },
  barColumn: { flex: 1, alignItems: 'stretch', justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 9, borderTopRightRadius: 9, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  barSelected: { backgroundColor: colors.accentBlue },
  barUnselected: { backgroundColor: colors.accentBlueSoft },
  barLabelsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: -6 },
  barLabel: { flex: 1, fontSize: 11.5, lineHeight: 15, fontFamily: typography.bodyStrong.fontFamily, color: colors.inkSoft, textAlign: 'center' },

  goalLineWrap: { paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.lineSoft, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  goalDash: { width: 14, height: 0, borderTopWidth: 2, borderStyle: 'dashed', borderTopColor: colors.accentGreen },
  goalLineText: { flex: 1, fontSize: 12.5, lineHeight: 17, fontFamily: typography.body.fontFamily, color: colors.inkSoft },

  // --- stat tiles ---
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statTile: { flex: 1, backgroundColor: colors.panel, borderRadius: radius.lg, padding: spacing.tight14, gap: 4 },
  statLabel: { fontSize: 12, lineHeight: 15, fontFamily: typography.body.fontFamily, color: colors.inkSoft },
  statValue: { fontSize: 17, lineHeight: 21, fontFamily: typography.h1b.fontFamily, color: colors.ink },

  // --- peak hours ---
  peakHeaderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  peakEyebrow: { ...typography.eyebrow, color: colors.inkSoft, fontSize: 11.5, letterSpacing: 0.6 },
  peakScope: { fontSize: 12, lineHeight: 15, fontFamily: typography.body.fontFamily, color: colors.inkSoft },
  peakCard: { backgroundColor: colors.panel, borderRadius: radius.lg2, padding: spacing.lg, gap: spacing.md, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2 },

  bestTimeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bestTimeTile: { width: 48, height: 48, borderRadius: radius.lg, backgroundColor: colors.accentGreenSoft, alignItems: 'center', justifyContent: 'center' },
  bestTimeTextCol: { flex: 1, minWidth: 0 },
  bestTimeLabel: { fontSize: 12.5, lineHeight: 17, fontFamily: typography.body.fontFamily, color: colors.inkSoft },
  bestTimeValue: { fontSize: 20, lineHeight: 26, fontFamily: typography.h1b.fontFamily, letterSpacing: -0.4, color: colors.ink, marginTop: 2 },
  bestTimeChip: { backgroundColor: colors.accentGreenSoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  bestTimeChipText: { fontSize: 12, lineHeight: 15, fontFamily: typography.bodyStrong.fontFamily, color: colors.accentGreenPressed },

  hourBarsRow: { flexDirection: 'row', alignItems: 'flex-end', height: 72, gap: 3 },
  hourBarColumn: { flex: 1, justifyContent: 'flex-end' },
  hourBar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  hourBarPeak: { backgroundColor: colors.accentGreen },
  hourBarNormal: { backgroundColor: colors.accentBlueSoft },
  hourAxisRow: { flexDirection: 'row', justifyContent: 'space-between' },
  hourAxisLabel: { fontSize: 11, lineHeight: 14, fontFamily: typography.body.fontFamily, color: colors.inkSoft },

  peakRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.lineSoft },
  peakRowFirst: { borderTopWidth: 0 },
  peakSwatch: { width: 10, height: 10, borderRadius: 3 },
  peakSwatchGreen: { backgroundColor: colors.accentGreen },
  peakSwatchBlue: { backgroundColor: colors.accentBlueSoft },
  peakRowLabel: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: typography.bodyStrong.fontFamily, color: colors.ink },
  peakRowLabelMuted: { color: colors.inkSoft },
  peakRowValue: { fontSize: 13, lineHeight: 18, fontFamily: typography.bodyStrong.fontFamily, color: colors.ink },

  infoNote: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.fill, borderRadius: radius.md, padding: spacing.tight10 },
  infoNoteText: { flex: 1, fontSize: 12.5, lineHeight: 18, fontFamily: typography.body.fontFamily, color: colors.inkSoft },
});
