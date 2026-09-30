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
  bandBody: { gap: 14 },
  track: { flexDirection: 'row', backgroundColor: 'rgba(255, 255, 255, 0.12)', borderRadius: radius.sm2, padding: 4 },
  segment: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.xs },
  segmentActive: { backgroundColor: colors.white },
  segmentText: { fontFamily: fontFamily.semibold, fontSize: 13.5, lineHeight: 20, color: 'rgba(255, 255, 255, 0.8)' },
  segmentTextActive: { fontFamily: fontFamily.bold, color: colors.accentBlue },
  version: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: 'rgba(255, 255, 255, 0.7)' },

  content: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
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
  disclosureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 11, paddingHorizontal: 14 },
  disclosureDivider: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
  disclosureBody: { flex: 1, gap: 2 },
  disclosureTitle: { fontFamily: fontFamily.semibold, fontSize: 13.5, lineHeight: 19, color: colors.ink },
  disclosureText: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: colors.inkSoft },
  accordionCard: { backgroundColor: colors.white, borderRadius: radius.lg, paddingHorizontal: 14, ...cardShadow },
  sectionBody: { fontFamily: fontFamily.regular, fontSize: 12.5, lineHeight: 19, color: colors.inkSoft },
});
