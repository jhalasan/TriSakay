import { StyleSheet } from 'react-native';
import { colors, fontFamily, radius, recordsPalette } from '@trisakay/ui';

const cardShadow = {
  shadowColor: colors.accentBlue,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.07,
  shadowRadius: 8,
  elevation: 2,
} as const;

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // --- Band ---
  bandBody: { paddingHorizontal: 4, gap: 10 },
  headline: { fontFamily: fontFamily.extrabold, fontSize: 24, lineHeight: 30, letterSpacing: -0.6, color: colors.white },
  headlineSub: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, color: 'rgba(255, 255, 255, 0.74)' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendText: { fontFamily: fontFamily.semibold, fontSize: 11.5, lineHeight: 16, color: 'rgba(255, 255, 255, 0.86)' },

  // --- Content ---
  content: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 24, gap: 18 },
  error: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: colors.danger },
  group: { gap: 8 },
  sectionLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },

  // --- Cards ---
  card: { backgroundColor: colors.white, borderRadius: radius.lg, ...cardShadow },
  // Border + clipped footer live on an inner view; the shadow stays on the wrapper (Android drops shadows on clipped rounded views).
  expiredClip: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: recordsPalette.dangerLine,
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 44 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
  rowBody: { flex: 1 },
  docName: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 21, color: colors.ink },
  statusExpired: { fontFamily: fontFamily.semibold, fontSize: 12.5, lineHeight: 18, color: colors.dangerPressed },
  statusExpiring: { fontFamily: fontFamily.semibold, fontSize: 12.5, lineHeight: 18, color: colors.accentBlue },
  statusPlain: { fontFamily: fontFamily.regular, fontSize: 12.5, lineHeight: 18, color: colors.inkSoft },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    backgroundColor: colors.accentBlueSoft,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  pillText: { fontFamily: fontFamily.bold, fontSize: 11, lineHeight: 16, color: colors.accentBluePressed },
  addLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  addText: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 18, color: colors.accentBlue },

  // --- Expired footer strip ---
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: recordsPalette.dangerWash,
    borderTopWidth: 1,
    borderTopColor: recordsPalette.dangerWashLine,
  },
  footerText: { flex: 1, fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: colors.inkSoft },
  updateButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.xs,
    backgroundColor: colors.accentBlue,
    paddingHorizontal: 12,
  },
  updateText: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 18, color: colors.white },

  footnote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 4 },
  footnoteText: { flex: 1, fontFamily: fontFamily.regular, fontSize: 12.5, lineHeight: 18, color: colors.inkSoft },
});
