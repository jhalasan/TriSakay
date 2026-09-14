import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.xs,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.inkFaint,
  },
  subject: {
    ...typography.h1,
    color: colors.ink,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  filedText: {
    ...typography.caption,
    color: colors.inkSoft,
  },

  progressCard: {
    gap: spacing.md,
    borderRadius: radius.md3,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.inkSoft,
  },
  stageRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stageMarkerCol: {
    alignItems: 'center',
    width: 10,
    paddingTop: 3,
  },
  stageDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2.5,
    borderColor: colors.line,
  },
  stageDotDone: {
    borderColor: colors.accentGreen,
    backgroundColor: colors.accentGreen,
  },
  stageLine: {
    flex: 1,
    minHeight: spacing.xl,
    width: 2,
    backgroundColor: colors.line,
    marginVertical: 3,
  },
  stageTextCol: {
    flex: 1,
    gap: 2,
    paddingBottom: spacing.md,
  },
  stageTitle: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  stageTitlePending: {
    color: colors.inkFaint,
  },
  stageBody: {
    ...typography.caption,
    color: colors.inkSoft,
  },
});
