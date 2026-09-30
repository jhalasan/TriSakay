import { StyleSheet } from 'react-native';
import { colors, fontFamily, radius } from '@trisakay/ui';

// P1-25 (2026-09-15 launch audit): passenger counterpart to the driver's account-suspended gate.
// Redesigned per the trip-records handoff §2c.
export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  motif: { position: 'absolute', top: -40, right: -50 },
  scrollContent: { flexGrow: 1, alignItems: 'center', paddingTop: 60, paddingHorizontal: 22, paddingBottom: 24, gap: 10 },
  haloOuter: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(251, 234, 232, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloInner: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  title: {
    marginTop: 14,
    fontFamily: fontFamily.extrabold,
    fontSize: 25,
    lineHeight: 31,
    letterSpacing: -0.5,
    color: colors.ink,
    textAlign: 'center',
  },
  body: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 21, color: colors.inkSoft, textAlign: 'center' },
  officeCard: {
    alignSelf: 'stretch',
    marginTop: 22,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    gap: 12,
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  officeLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  officeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  officeText: { flex: 1, fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 20, color: colors.ink },
  bottom: { paddingHorizontal: 22, gap: 6, backgroundColor: colors.bg },
  caption: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: colors.inkFaint, textAlign: 'center' },
  actions: { gap: 6 },
});
