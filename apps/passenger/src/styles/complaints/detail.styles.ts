import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  bandRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.tight22,
  },
  backTile: {
    width: 40,
    height: 40,
    borderRadius: radius.sm2,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bandTextCol: { flex: 1, gap: spacing.xs, minWidth: 0 },
  eyebrow: { ...typography.eyebrow, fontSize: 11, color: colors.white, opacity: 0.72 },
  subject: { fontSize: 24, lineHeight: 30, fontFamily: typography.display.fontFamily, letterSpacing: -0.6, color: colors.white },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  filedText: { ...typography.caption, fontSize: 12, color: colors.white, opacity: 0.72 },

  skeletonCol: { flex: 1, gap: spacing.sm, paddingTop: spacing.xs },
  skeletonBarSmall: { width: 100, height: 12, borderRadius: 6, backgroundColor: '#E4E8EC' },
  skeletonBarLarge: { width: 200, height: 20, borderRadius: 8, backgroundColor: '#E4E8EC' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },

  nowCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.accentBlue,
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 3,
  },
  nowCardEscalated: { borderColor: colors.danger },
  nowTextSlot: { flex: 1, gap: 2 },
  nowEyebrow: { ...typography.eyebrow, fontSize: 11, color: colors.accentBlue },
  nowEyebrowEscalated: { color: colors.dangerPressed },
  nowTitle: { fontSize: 15, lineHeight: 21, fontFamily: typography.bodyStrong.fontFamily, color: colors.ink, marginTop: 2 },
  nowBody: { ...typography.caption, fontSize: 12.5, lineHeight: 18, color: colors.inkSoft, marginTop: 2 },

  decisionCard: {
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },

  progressCard: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...elevation.card,
  },
  sectionLabel: { ...typography.eyebrow, color: colors.inkSoft },

  followUpRow: { flexDirection: 'row', gap: spacing.md, padding: spacing.xs },
  followUpText: { ...typography.caption, fontSize: 12.5, lineHeight: 18, color: colors.inkSoft, flex: 1 },
  followUpLink: { fontFamily: typography.bodyStrong.fontFamily, color: colors.accentBlue },

  detailsCard: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    ...elevation.card,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  detailsDivider: { height: 1, backgroundColor: colors.lineSoft },
  detailsTextSlot: { flex: 1, gap: 1, minWidth: 0 },
  detailsTitle: { ...typography.bodySm, color: colors.ink },
  detailsSub: { ...typography.caption, fontSize: 12, color: colors.inkSoft },
});
