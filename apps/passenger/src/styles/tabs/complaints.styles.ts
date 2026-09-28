import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  bandContent: {
    paddingHorizontal: spacing.tight18,
    paddingTop: spacing.sm,
    paddingBottom: spacing.tight22,
  },
  title: { ...typography.h1b, color: colors.white },
  subline: { ...typography.caption, color: colors.white, opacity: 0.72, marginTop: 4 },
  statsStrip: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
  },
  statsCol: { flex: 1, alignItems: 'center' },
  statsDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.14)', marginHorizontal: spacing.md },
  statsValue: { fontSize: 22, lineHeight: 26, fontFamily: typography.h1b.fontFamily, color: colors.white },
  statsLabel: { ...typography.labelSm, color: colors.white, opacity: 0.72, marginTop: 2 },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.tight44 * 1.7,
    gap: spacing.xl,
  },

  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.panel,
    borderRadius: radius.lg2,
    padding: spacing.lg,
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  reportTextSlot: { flex: 1, gap: 2 },
  reportTitle: { ...typography.bodyStrong, color: colors.ink },
  reportSub: { ...typography.caption, color: colors.inkSoft },

  sectionLabel: { ...typography.eyebrow, color: colors.inkSoft, marginBottom: spacing.sm },

  issueGrid: { flexDirection: 'row', gap: spacing.sm },
  issueTile: {
    flex: 1,
    backgroundColor: colors.panel,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.sm,
    ...elevation.card,
  },
  issueLabel: { fontSize: 12.5, lineHeight: 16, fontFamily: typography.bodyStrong.fontFamily, color: colors.ink },

  casesHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seeAll: { ...typography.chip, color: colors.accentBlue },
  casesList: { gap: spacing.sm, marginTop: spacing.sm },
  caseCard: {
    backgroundColor: colors.panel,
    borderRadius: radius.md3,
    padding: spacing.lg,
    gap: spacing.sm,
    ...elevation.card,
  },
  caseTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  caseRefLine: { fontSize: 11, lineHeight: 16, fontFamily: typography.label.fontFamily, letterSpacing: 0.5, color: colors.inkFaint, textTransform: 'none' },
  caseSubject: { ...typography.bodyLg, color: colors.ink },
  caseMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  caseMeta: { ...typography.caption, color: colors.inkSoft },

  emptyPanel: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius.card,
    padding: spacing.xl,
  },
  emptyText: { ...typography.caption, color: colors.inkSoft, textAlign: 'center' },
});
