import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.lg, paddingTop: spacing.md, gap: spacing.lg, paddingBottom: spacing.tight44 * 1.7 },

  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  identityTextSlot: { flex: 1, gap: 1, minWidth: 0 },
  greetingLine: { ...typography.caption, fontSize: 12, color: colors.inkSoft },
  firstNameText: { ...typography.bodySm, fontSize: 17, lineHeight: 22, color: colors.ink },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: radius.sm2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    ...elevation.card,
  },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.white,
  },

  // --- online hero (README §3a/3b) ---
  // Shadow on this outer wrapper, never on GradientSurface's own style — it
  // sets overflow:'hidden', and combining that with a radius + shadow on
  // Android bleeds the shadow past the rounded corners.
  heroShadowWrap: {
    borderRadius: radius.xl2,
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
    elevation: 10,
  },
  consoleOnline: { borderRadius: radius.xl2, overflow: 'hidden', padding: spacing.tight18, paddingBottom: spacing.tight22, position: 'relative', gap: spacing.tight14 },
  consoleMotif: { position: 'absolute', top: -50, right: -50 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pulseHost: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  statusDotStatic: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accentGreenSoft },
  youreOnlineText: { ...typography.bodySm, fontSize: 13, color: colors.white },
  zoneLine: { ...typography.caption, fontSize: 11.5, color: colors.white, opacity: 0.72, marginTop: 1 },
  goOfflineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.tight14,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
  },
  goOfflineText: { ...typography.bodySm, fontSize: 13, color: colors.white },

  earnedTodayEyebrow: { ...typography.bodySm, fontSize: 11, lineHeight: 15, letterSpacing: 0.8, color: colors.white, opacity: 0.72 },
  earningsAmount: { ...typography.amount, color: colors.white },

  goalBlock: { gap: spacing.xs },
  goalTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' },
  goalFill: { height: 8, borderRadius: 4, backgroundColor: colors.accentGreenSoft },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  goalText: { ...typography.caption, fontSize: 12, fontFamily: typography.bodyStrong.fontFamily, color: colors.accentBlueSoft },

  statsGrid: { flexDirection: 'row', gap: spacing.sm },
  statTile: { flex: 1, backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: radius.md3, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, gap: 2 },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue: { fontSize: 18, lineHeight: 22, fontFamily: typography.h1b.fontFamily, color: colors.white },
  statLabel: { ...typography.caption, fontSize: 11.5, color: colors.white, opacity: 0.72 },

  // --- offline status card (README §3c) ---
  offlineStatusCardShadowWrap: {
    borderRadius: radius.xl2,
    backgroundColor: colors.white,
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
  },
  offlineStatusCard: {
    borderRadius: radius.xl2,
    overflow: 'hidden',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.tight18,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
    position: 'relative',
  },
  offlineMotif: { position: 'absolute', top: -40, right: -44 },
  offlineBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  offlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.lineStrong },
  offlineBadgeText: { ...typography.bodySm, fontSize: 13, color: colors.inkSoft },
  readyTitle: { fontSize: 26, lineHeight: 32, fontFamily: typography.h1b.fontFamily, letterSpacing: -0.6, color: colors.ink },
  readyBody: { ...typography.body, fontSize: 14, lineHeight: 21, color: colors.inkSoft, marginTop: -spacing.sm },
  goOnlineButtonShadowWrap: {
    borderRadius: radius.md3,
    backgroundColor: colors.accentGreen,
    shadowColor: colors.accentGreen,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 6,
  },
  goOnlineButton: { minHeight: 58, borderRadius: radius.md3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  goOnlineText: { ...typography.h3b, fontSize: 17, lineHeight: 21, color: colors.white },
  offlineFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  offlineFooterText: { flex: 1, ...typography.caption, fontSize: 12.5, color: colors.inkSoft },

  offlineStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.fill,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  offlineStripText: { flex: 1, ...typography.caption, fontSize: 13, lineHeight: 19, color: colors.inkSoft },

  // --- request slot ---
  sectionLabel: { ...typography.eyebrow, color: colors.inkSoft },
  requestSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  listeningSectionWrap: { gap: spacing.md },
  countdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  countdownChipText: { ...typography.bodySm, fontSize: 12, lineHeight: 16, color: colors.danger },

  // Shadow lives on this outer wrapper, never on the same view as
  // overflow:'hidden' + borderRadius — combining them on Android makes the
  // elevation shadow render as an unclipped rectangle that bleeds past the
  // rounded corners and shows a ghosted duplicate of the clipped content.
  listeningPanelShadowWrap: {
    borderRadius: radius.xl2,
    backgroundColor: colors.white,
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 4,
  },
  listeningPanel: {
    borderRadius: radius.xl2,
    backgroundColor: colors.white,
    padding: spacing.tight18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    position: 'relative',
    overflow: 'hidden',
  },
  listeningMotif: { position: 'absolute', top: -30, right: -30 },
  listeningIconHost: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  listeningIconCircle: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listeningTextSlot: { flex: 1, gap: 2 },
  listeningTitle: { ...typography.bodyStrong, fontSize: 16, color: colors.ink },
  listeningMessage: { ...typography.caption, fontSize: 13, lineHeight: 19, color: colors.inkSoft },

  // --- recent / last trip panels (shared) ---
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seeAllLink: { ...typography.bodySm, fontSize: 13, color: colors.accentBlue, minHeight: 32 },
  tripsPanel: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    ...elevation.card,
  },
  tripRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  tripIconTile: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.accentGreenSoft, alignItems: 'center', justifyContent: 'center' },
  tripTextSlot: { flex: 1, gap: 2, minWidth: 0 },
  tripRoute: { fontSize: 14.5, lineHeight: 20, fontFamily: typography.bodyStrong.fontFamily, color: colors.ink },
  tripMeta: { ...typography.caption, fontSize: 12, color: colors.inkSoft },
  tripFare: { ...typography.bodyLg, color: colors.ink },

  // --- offline "this week" grid ---
  thisWeekGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  thisWeekCard: { flex: 1, backgroundColor: colors.white, borderRadius: radius.md3, padding: spacing.lg, gap: 4, ...elevation.card },
  thisWeekLabel: { ...typography.caption, fontSize: 12, color: colors.inkSoft },
  thisWeekValue: { fontSize: 22, lineHeight: 26, fontFamily: typography.h1b.fontFamily, color: colors.ink },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  deltaText: { fontSize: 11.5, lineHeight: 15, fontFamily: typography.bodyStrong.fontFamily, color: colors.accentGreenPressed },

  error: { ...typography.caption, color: colors.danger },
});
