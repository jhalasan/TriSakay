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
  scroll: { flexGrow: 1 },

  // --- Hero (inside the navy band) ---
  hero: { paddingHorizontal: 4, gap: 2 },
  heroDate: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: 'rgba(255, 255, 255, 0.78)' },
  heroFare: { fontFamily: fontFamily.extrabold, fontSize: 44, lineHeight: 52, letterSpacing: -1.4, color: colors.white },
  heroCancelled: { fontFamily: fontFamily.extrabold, fontSize: 32, lineHeight: 40, letterSpacing: -1, color: colors.white },
  heroMetaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  heroMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroMeta: { fontFamily: fontFamily.semibold, fontSize: 12.5, lineHeight: 18, color: colors.white },
  heroDiscount: { fontFamily: fontFamily.semibold, fontSize: 12.5, lineHeight: 18, color: recordsPalette.onDarkGreenLight },
  heroDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255, 255, 255, 0.5)' },
  heroSub: { fontFamily: fontFamily.semibold, fontSize: 12.5, lineHeight: 18, color: 'rgba(255, 255, 255, 0.86)' },

  // --- Body ---
  body: { paddingHorizontal: 16, gap: 12 },
  overlapSlot: { marginTop: -42 },
  heroShadow: {
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, ...cardShadow },
  cardHero: { backgroundColor: colors.white, borderRadius: radius.lg2 },
  routePad: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 14 },

  // --- Cancelled reason ---
  reasonCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16 },
  reasonText: { flex: 1, gap: 2 },
  reasonEyebrow: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.dangerPressed,
  },
  reasonValue: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 21, color: colors.ink },

  // --- Driver card ---
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  driverRowCompact: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  driverBody: { flex: 1, gap: 4 },
  driverNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  driverName: { flexShrink: 1, fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 20, color: colors.ink },
  driverNameCompact: { fontFamily: fontFamily.bold, fontSize: 14.5, lineHeight: 20, color: colors.ink },
  driverSub: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: colors.inkSoft },
  ratingText: { fontFamily: fontFamily.bold, fontSize: 12.5, lineHeight: 18, color: colors.ink },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  tag: {
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingVertical: 1,
    paddingHorizontal: 7,
  },
  tagText: { fontFamily: 'monospace', fontSize: 11.5, lineHeight: 16, letterSpacing: 0.6, color: colors.ink },

  // --- Receipt ---
  receipt: { padding: 16, gap: 10 },
  sectionLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  receiptRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  receiptLabel: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
  receiptValue: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
  receiptDiscount: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 20, color: colors.accentGreenPressed },
  receiptDivider: { height: 1, backgroundColor: colors.lineSoft },
  totalLabel: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 21, color: colors.ink },
  totalValue: { fontFamily: fontFamily.extrabold, fontSize: 18, lineHeight: 24, color: colors.ink },
  paymentInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bg,
    borderRadius: radius.sm2,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  paymentName: { flex: 1, fontFamily: fontFamily.semibold, fontSize: 13.5, lineHeight: 19, color: colors.ink },

  // --- Trip reference ---
  refRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 },
  refRowPad: { paddingVertical: 4, paddingHorizontal: 6 },
  refLabel: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  refValue: { fontFamily: 'monospace', fontSize: 13, lineHeight: 18, color: colors.ink },
  copyLink: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44, paddingHorizontal: 4 },
  copyText: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 18, color: colors.accentBlue },

  // --- Bottom bar ---
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  helpButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  helpText: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20, color: colors.ink },
  primarySlot: { flex: 1 },
  primaryShadow: {
    borderRadius: 14,
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
    elevation: 6,
  },
  primary: { minHeight: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  primaryText: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 21, color: colors.white },
});
