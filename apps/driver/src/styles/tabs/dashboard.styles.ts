import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.lg, paddingTop: spacing.md, gap: spacing.lg, paddingBottom: spacing.tight44 * 1.7 },

  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  identityTextSlot: { flex: 1, gap: 2 },
  identityName: { ...typography.bodyStrong, fontSize: 16, lineHeight: 21, color: colors.ink },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  verifiedText: { ...typography.caption, fontSize: 12, lineHeight: 16, color: colors.inkSoft },
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
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.white,
  },

  // --- duty console: online ---
  consoleOnline: { borderRadius: radius.lg2, overflow: 'hidden', padding: spacing.tight18, paddingBottom: spacing.tight22, position: 'relative' },
  consoleMotif: { position: 'absolute', bottom: -60, right: -46 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pulseHost: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  statusDotStatic: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accentGreenSoft },
  statusLabelOnline: { ...typography.bodySm, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.white },
  toggleTrack: { width: 56, height: 32, borderRadius: 16, justifyContent: 'center', padding: 3 },
  toggleTrackOn: { backgroundColor: colors.accentGreenSoft, alignItems: 'flex-end' },
  toggleTrackOff: { backgroundColor: colors.line, alignItems: 'flex-start' },
  toggleKnob: { width: 26, height: 26, borderRadius: 13 },
  toggleKnobOn: { backgroundColor: colors.accentBlue },
  toggleKnobOff: { backgroundColor: colors.white },

  earningsEyebrow: { ...typography.bodySm, fontSize: 11, lineHeight: 15, letterSpacing: 0.9, color: colors.white, opacity: 0.6, marginTop: spacing.tight14 },
  earningsAmount: { fontSize: 40, lineHeight: 46, fontFamily: 'Poppins_800ExtraBold', letterSpacing: -1.2, color: colors.white },

  metaRow: {
    flexDirection: 'row',
    gap: spacing.tight14,
    marginTop: spacing.tight14,
    paddingTop: spacing.tight14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.16)',
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaTextOnline: { ...typography.bodySm, color: colors.white },

  // --- duty console: offline ---
  consoleOffline: { borderRadius: radius.lg2, borderWidth: 1, borderColor: colors.lineSoft, backgroundColor: colors.white, padding: spacing.tight18, paddingBottom: spacing.tight22 },
  statusDotOffline: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.inkFaint },
  statusLabelOffline: { ...typography.bodySm, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.inkSoft },
  earningsEyebrowOffline: { ...typography.bodySm, fontSize: 11, lineHeight: 15, letterSpacing: 0.9, color: colors.inkSoft, marginTop: spacing.tight14 },
  earningsAmountOffline: { fontSize: 40, lineHeight: 46, fontFamily: 'Poppins_800ExtraBold', letterSpacing: -1.2, color: colors.ink },
  metaTextOffline: { ...typography.bodySm, color: colors.inkSoft },
  // Shadow lives on this outer wrapper, never on the GradientSurface's own
  // style — see listeningPanelShadowWrap above for why.
  goOnlineButtonShadowWrap: {
    marginTop: spacing.lg,
    borderRadius: radius.sm2,
    backgroundColor: colors.accentBlue,
    ...elevation.button,
  },
  goOnlineButton: {
    minHeight: 52,
    borderRadius: radius.sm2,
  },
  goOnlineInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: '100%' },
  goOnlineText: { ...typography.h3b, fontSize: 16, lineHeight: 20, color: colors.white },

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
  countdownChip: { backgroundColor: colors.dangerSoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  countdownChipText: { ...typography.bodySm, fontSize: 11, lineHeight: 16, color: colors.danger },

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
    paddingVertical: spacing.tight44,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  listeningMotif: { position: 'absolute', top: -30, right: -30 },
  listeningIconHost: { width: 74, height: 74, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  listeningIconCircle: {
    position: 'absolute',
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listeningTitle: { ...typography.h3b, color: colors.ink },
  listeningMessage: { ...typography.caption, color: colors.inkSoft, textAlign: 'center', marginTop: spacing.xs, maxWidth: 250 },

  error: { ...typography.caption, color: colors.danger },
});
