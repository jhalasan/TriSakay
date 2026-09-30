import { StyleSheet } from 'react-native';
import { colors, fontFamily, radius } from '@trisakay/ui';

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
  heroEyebrow: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.66)',
  },
  heroAmount: { fontFamily: fontFamily.extrabold, fontSize: 44, lineHeight: 52, letterSpacing: -1.4, color: colors.white },
  heroCancelled: { fontFamily: fontFamily.extrabold, fontSize: 32, lineHeight: 40, letterSpacing: -1, color: colors.white },
  heroMetaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  heroMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroMeta: { fontFamily: fontFamily.semibold, fontSize: 12.5, lineHeight: 18, color: colors.white },
  heroMetaDate: { fontFamily: fontFamily.regular, fontSize: 12.5, lineHeight: 18, color: 'rgba(255, 255, 255, 0.78)' },
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

  // --- Passenger row ---
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  passengerBody: { flex: 1 },
  passengerLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.inkFaint,
  },
  passengerName: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 21, color: colors.ink },
  seatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  seatChipText: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16, color: colors.ink },

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

  // --- Payment + reference ---
  listCard: { paddingHorizontal: 16 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  listRowDivider: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
  listBody: { flex: 1 },
  listTitle: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 21, color: colors.ink },
  listTitleMono: { fontFamily: 'monospace', fontSize: 14, lineHeight: 20, color: colors.ink },
  listSub: { fontFamily: fontFamily.regular, fontSize: 12.5, lineHeight: 18, color: colors.inkSoft },
  refRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 4, paddingHorizontal: 6 },
  refLabel: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  refValue: { fontFamily: 'monospace', fontSize: 13, lineHeight: 18, color: colors.ink },

  // --- Report row ---
  reportRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 44 },
  reportTitle: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 20, color: colors.ink },
  reportHint: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: colors.inkSoft },
});
