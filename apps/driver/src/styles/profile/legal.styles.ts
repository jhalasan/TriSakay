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
    gap: spacing.md,
  },
  version: {
    ...typography.caption,
    color: colors.inkSoft,
    marginBottom: spacing.xs,
  },
  paragraph: {
    ...typography.body,
    color: colors.inkSoft,
  },
  sectionLabel: {
    ...typography.eyebrow,
    color: colors.inkSoft,
    marginTop: spacing.md,
  },
  disclosureCard: { borderRadius: radius.md, padding: 0 },
  disclosureRow: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  disclosureRowDivided: {
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  disclosureTitle: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  disclosureBody: {
    ...typography.caption,
    color: colors.inkSoft,
  },
});
