import { StyleSheet } from 'react-native';
import { colors, fontFamily, radius, recordsPalette } from '@trisakay/ui';

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },

  // --- Band ---
  bandCenter: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, gap: 6 },
  haloOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(233, 247, 227, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentGreenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrived: { marginTop: 8, fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 21, color: colors.white },
  fare: { fontFamily: fontFamily.extrabold, fontSize: 46, lineHeight: 54, letterSpacing: -1.4, color: colors.white },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  payText: { fontFamily: fontFamily.semibold, fontSize: 12.5, lineHeight: 18, color: 'rgba(255, 255, 255, 0.9)' },

  // --- Content ---
  content: { marginTop: -40, paddingHorizontal: 16, gap: 12 },
  heroShadow: {
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  softShadow: {
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHero: { backgroundColor: colors.white, borderRadius: radius.lg2 },
  routePad: { padding: 16 },

  // --- Driver + rate card ---
  rateCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg2,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 12,
  },
  driverRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverName: { flex: 1, fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 20, color: colors.ink },
  plateTag: { borderWidth: 1.5, borderColor: colors.ink, borderRadius: 6, paddingVertical: 1, paddingHorizontal: 7 },
  plateText: { fontFamily: 'monospace', fontSize: 11.5, lineHeight: 16, letterSpacing: 0.6, color: colors.ink },
  hairline: { alignSelf: 'stretch', height: 1, backgroundColor: colors.lineSoft },
  rateTitle: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 22, color: colors.ink },
  rateHint: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: colors.inkSoft, textAlign: 'center' },
  ratedNote: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 20, color: colors.accentGreenPressed },

  // --- Fare-flagged (amber) card ---
  amberCard: {
    backgroundColor: recordsPalette.amberBg,
    borderWidth: 1.5,
    borderColor: recordsPalette.amberBorder,
    borderRadius: radius.lg2,
    padding: 16,
    gap: 12,
  },
  amberTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  amberTile: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: recordsPalette.amberTile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amberText: { flex: 1, gap: 2 },
  amberTitle: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 21, color: colors.ink },
  amberBody: { fontFamily: fontFamily.regular, fontSize: 12.5, lineHeight: 18, color: recordsPalette.amberText },
  compare: { backgroundColor: colors.white, borderRadius: radius.sm2, paddingVertical: 10, paddingHorizontal: 12, gap: 6 },
  compareRow: { flexDirection: 'row', gap: 12 },
  compareLabel: { width: 76, fontFamily: fontFamily.regular, fontSize: 12.5, lineHeight: 18, color: colors.inkSoft },
  compareValue: { flex: 1, fontFamily: fontFamily.semibold, fontSize: 12.5, lineHeight: 18, color: colors.ink },
  reportButton: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  reportButtonText: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 20, color: colors.white },

  // --- Bottom bar ---
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 4,
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  skipButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
});
