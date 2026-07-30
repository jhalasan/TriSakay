import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  title: {
    ...typography.h1,
    color: colors.ink,
  },
  version: {
    ...typography.caption,
    color: colors.inkSoft,
  },
  /** Explicit flex: a ScrollView between fixed siblings otherwise sizes to content. */
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  paragraph: {
    ...typography.body,
    color: colors.inkSoft,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.inkSoft,
    marginTop: spacing.md,
  },
  disclosureCard: {
    padding: 0,
  },
  disclosureRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
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
  /** Pinned so the primary action stays reachable no matter how long the policy runs. */
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    backgroundColor: colors.panel,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
});
