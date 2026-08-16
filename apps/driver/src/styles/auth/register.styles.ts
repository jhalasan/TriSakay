import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  heroBand: {
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  motif: { position: 'absolute', top: -40, right: -40 },
  /** Badge container — the mark image sits inside this, not stretched to fill it. */
  markBadge: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.card,
  },
  mark: { width: 42, height: 50 },
  stepWrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.xs },
  stepLabel: { ...typography.label, color: colors.inkSoft },
  stepTrack: { flexDirection: 'row', gap: spacing.xs },
  stepSegment: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: colors.line },
  stepSegmentActive: { backgroundColor: colors.accentBlue },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  stepIntro: { ...typography.body, color: colors.inkSoft },
  version: { ...typography.caption, color: colors.inkSoft },
  paragraph: { ...typography.body, color: colors.inkSoft },
  sectionLabel: { ...typography.label, color: colors.inkSoft, marginTop: spacing.md },
  disclosureCard: { padding: 0 },
  disclosureRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.xs },
  disclosureRowDivided: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
  disclosureTitle: { ...typography.bodyStrong, color: colors.ink },
  disclosureBody: { ...typography.caption, color: colors.inkSoft },
  authError: { ...typography.caption, color: colors.danger },
});
