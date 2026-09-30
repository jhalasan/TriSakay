import { StyleSheet } from 'react-native';
import { colors, fontFamily, radius } from '@trisakay/ui';

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },

  // --- Band: large (before a score) and compact (score <= 3 or keyboard open) ---
  // No paddingHorizontal here: NavyBandHeader already insets its content 16px, and zeroing it pushed the eyebrow, avatar and Skip link to the screen edges.
  bandLarge: { gap: 16, paddingBottom: 6 },
  bandCompact: { gap: 12, paddingBottom: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.72)',
  },
  skipButton: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 4 },
  skipText: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 20, color: colors.white },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  driverText: { flex: 1, gap: 2 },
  nameLarge: { fontFamily: fontFamily.extrabold, fontSize: 22, lineHeight: 28, color: colors.white },
  nameCompact: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 23, color: colors.white },
  fareLine: { fontFamily: fontFamily.regular, fontSize: 12.5, lineHeight: 18, color: 'rgba(255, 255, 255, 0.78)' },
  fareLineCompact: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: 'rgba(255, 255, 255, 0.78)' },

  // --- Body ---
  emptyBody: { paddingTop: 34, paddingHorizontal: 20, alignItems: 'center', gap: 14 },
  emptyTitle: { fontFamily: fontFamily.extrabold, fontSize: 24, lineHeight: 30, color: colors.ink, textAlign: 'center' },
  emptyHint: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, color: colors.inkSoft, textAlign: 'center' },
  body: { paddingTop: 22, paddingHorizontal: 16, paddingBottom: 24, gap: 18 },
  starsBlock: { alignItems: 'center', gap: 6 },
  scoreWord: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 23 },

  // --- Tags ---
  sectionLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.inkSoft,
    marginBottom: 8,
  },
  tagGrid: { gap: 8 },
  tagRow: { flexDirection: 'row', gap: 8 },

  // --- Comment ---
  commentCollapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0, 46, 96, 0.4)',
    borderRadius: radius.card,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  commentCollapsedLabel: { flex: 1, fontFamily: fontFamily.semibold, fontSize: 13.5, lineHeight: 19, color: colors.accentBlue },
  commentCollapsedHint: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: colors.inkFaint },

  // --- Report card (<= 2 stars) ---
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.card,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  reportText: { flex: 1 },
  reportTitle: { fontFamily: fontFamily.bold, fontSize: 13.5, lineHeight: 19, color: colors.ink },
  reportBody: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: colors.ink, opacity: 0.8 },
  reportAction: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 18, color: colors.dangerPressed },

  // --- Bottom bar (sits in the flow so the KeyboardAvoidingView lifts it above the keyboard) ---
  bottomBar: {
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  errorText: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: colors.danger },
  fallbackNote: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 21, color: colors.inkSoft, textAlign: 'center', paddingHorizontal: 20 },
});
