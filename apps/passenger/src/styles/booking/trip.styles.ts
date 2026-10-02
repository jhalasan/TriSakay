import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  mapFill: { ...StyleSheet.absoluteFillObject },

  // --- status pill (Part B §B3) ---
  statusPillWrap: { position: 'absolute', left: spacing.lg },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
    elevation: 4,
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    maxWidth: 220,
  },
  statusDot: { width: 9, height: 9, borderRadius: 4.5 },
  statusPillText: { ...typography.bodyStrong, fontSize: 13, color: colors.ink, flexShrink: 1 },

  // --- SOS FAB (Part B §B3) ---
  sosWrap: { position: 'absolute', right: spacing.lg, alignItems: 'center', gap: 5 },
  sosChip: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    elevation: 2,
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
  },
  sosChipText: { ...typography.labelXs, textTransform: 'none', letterSpacing: 0, color: colors.danger },

  // --- floating sheet (Part B §B4) ---
  sheetWrap: { position: 'absolute', left: 10, right: 10 },
  sheet: {
    backgroundColor: colors.white,
    borderRadius: 26,
    paddingTop: 2,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: spacing.md,
    maxHeight: 560,
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 12,
  },
  // A taller touch target around the visible 4px handle, so it is easy to grab and drag.
  handleTouch: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 8 },
  // Same grip as the driver's ride card: a slightly larger, higher-contrast pill.
  handle: { width: 48, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, alignSelf: 'center' },
  sheetScrollContent: { gap: spacing.md },

  // --- transfer banner (Part B §B6) ---
  transferBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.accentBlueSoft,
    borderRadius: radius.card,
    padding: 12,
    paddingLeft: 14,
  },
  transferTextCol: { flex: 1, gap: 2 },
  transferTitle: { ...typography.bodyStrong, fontSize: 14, color: colors.ink },
  transferBody: { ...typography.body, fontSize: 12.5, lineHeight: 17, color: colors.inkSoft },
  transferDismiss: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },

  // --- status block (eyebrow/headline/sub) ---
  statusBlock: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  statusTextCol: { flex: 1, gap: 4 },
  eyebrow: { ...typography.eyebrow, fontSize: 11.5, color: colors.accentBlue },
  headline: { ...typography.h1, fontSize: 24, lineHeight: 29, color: colors.ink },
  sub: { ...typography.body, fontSize: 13.5, lineHeight: 19, color: colors.inkSoft },
  checkTile: { width: 48, height: 48, borderRadius: radius.card, backgroundColor: colors.accentGreenSoft, alignItems: 'center', justifyContent: 'center' },

  // --- progress (Part B §B4.1) ---
  progressRow: { flexDirection: 'row', gap: 4 },
  progressBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.accentBlueSoft },
  progressBarFilled: { backgroundColor: colors.accentBlue },
  progressLabelsRow: { flexDirection: 'row' },
  progressLabelWrap: { flex: 1 },
  progressLabel: { ...typography.label, fontSize: 11, textTransform: 'none', letterSpacing: 0, color: colors.inkFaint },
  progressLabelActive: { color: colors.accentBlue, fontFamily: typography.bodyStrong.fontFamily },

  // --- driver strip (Part B §B4.2) ---
  driverStrip: { backgroundColor: colors.bg, borderRadius: radius.card, padding: 12, gap: 10 },
  driverStripRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  driverInfoCol: { flex: 1, minWidth: 0, gap: 2 },
  driverNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  driverName: { ...typography.bodySm, fontSize: 15.5, color: colors.ink, flexShrink: 1 },
  newTag: { backgroundColor: colors.accentBlueSoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  newTagText: { ...typography.label, fontSize: 10.5, letterSpacing: 0.5, color: colors.accentBluePressed },
  // Wraps inside the info column so "PSO verified" drops under the rating on a narrow card instead of running into the plate tag.
  driverMetaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.md, rowGap: 2 },
  driverMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  driverMetaText: { fontSize: 12, lineHeight: 15, fontFamily: typography.body.fontFamily, color: colors.inkSoft },
  plateTag: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignItems: 'center',
    flexShrink: 0,
  },
  plateLabel: { ...typography.label, fontSize: 9.5, letterSpacing: 0.8, color: colors.inkSoft },
  plateValue: { ...typography.h3, fontSize: 15, letterSpacing: 0.6, color: colors.ink },

  contactRow: { flexDirection: 'row', gap: spacing.sm },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    // minWidth 0 + hidden: a flex:1 button otherwise grows to its content (long "Message <name>" + badge) and spills over its neighbour.
    minWidth: 0,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.accentBlueSoft,
  },
  contactButtonFilled: {
    backgroundColor: colors.accentBlue,
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 4,
  },
  contactLabel: { ...typography.bodySm, fontSize: 14, color: colors.accentBlue, flexShrink: 1 },
  contactLabelFilled: { fontSize: 14.5, color: colors.white },
  contactCountPill: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  contactCountPillText: { ...typography.label, fontSize: 12, textTransform: 'none', letterSpacing: 0, color: colors.accentBlue },

  // --- route rail (Part B §B4.3) ---
  routeRail: { gap: 8 },
  routeRow: { flexDirection: 'row', gap: spacing.sm },
  railCol: { alignItems: 'center', width: 10 },
  railRingPickup: { width: 10, height: 10, borderRadius: 5, borderWidth: 2.5, borderColor: colors.accentGreen },
  railLine: { width: 2, minHeight: 16, backgroundColor: colors.line, marginVertical: 2 },
  railSquareDropoff: { width: 10, height: 10, borderRadius: 2, backgroundColor: colors.accentBlue },
  routeTextCol: { flex: 1, gap: 2 },
  routeLabel: { fontSize: 11.5, lineHeight: 15, fontFamily: typography.body.fontFamily, color: colors.inkFaint },
  routeAddress: { ...typography.bodySm, fontSize: 14.5, color: colors.ink },

  // --- fare row (Part B §B4.4) ---
  fareRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingTop: spacing.md },
  farePayLine: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: typography.body.fontFamily, color: colors.inkSoft },
  fareAmount: { ...typography.h2, fontSize: 18, color: colors.ink },

  // --- cancel (Part B §B4.5) ---
  cancelButton: { minHeight: 50, borderRadius: radius.sm2, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  cancelButtonText: { ...typography.bodySm, fontSize: 15, color: colors.danger },

  error: { ...typography.caption, color: colors.danger, textAlign: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
});
