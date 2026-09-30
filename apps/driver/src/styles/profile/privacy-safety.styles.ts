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
  content: { paddingTop: 6, paddingHorizontal: 16, paddingBottom: 24, gap: 14 },
  sectionLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.inkSoft,
    marginBottom: 8,
  },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, ...cardShadow },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, padding: 14 },
  navBody: { flex: 1 },
  navTitle: { fontFamily: fontFamily.semibold, fontSize: 14.5, lineHeight: 20, color: colors.ink },
  navSub: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: colors.inkSoft },
  learnCard: { backgroundColor: colors.white, borderRadius: radius.lg, paddingHorizontal: 14, ...cardShadow },
  learnDivider: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
  learnBody: { fontFamily: fontFamily.regular, fontSize: 12.5, lineHeight: 19, color: colors.inkSoft },
  tipList: { gap: 8 },
  tipRow: { flexDirection: 'row', gap: 8 },
  tipBullet: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.inkFaint, marginTop: 7 },
  tipText: { flex: 1, fontFamily: fontFamily.regular, fontSize: 12.5, lineHeight: 19, color: colors.inkSoft },
  countPill: { borderRadius: radius.pill, backgroundColor: colors.fill, paddingVertical: 2, paddingHorizontal: 9 },
  countText: { fontFamily: fontFamily.semibold, fontSize: 11, lineHeight: 16, color: colors.inkSoft },
  footerLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44 },
  footerLinkText: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 18, color: colors.accentBlue },
});
