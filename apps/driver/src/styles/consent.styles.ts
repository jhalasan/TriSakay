import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md },
  title: { ...typography.h1, color: colors.ink },
  version: { ...typography.caption, color: colors.inkSoft, marginTop: spacing.xs },
  scrollArea: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  paragraph: { ...typography.body, color: colors.inkSoft, marginBottom: spacing.md },
  sectionLabel: { ...typography.label, color: colors.inkSoft, marginTop: spacing.lg, marginBottom: spacing.sm },
  disclosureCard: { borderRadius: radius.md, padding: 0 },
  disclosureRow: { padding: spacing.lg },
  disclosureRowDivided: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
  disclosureTitle: { ...typography.bodyStrong, color: colors.ink, marginBottom: spacing.xs },
  disclosureBody: { ...typography.caption, color: colors.inkSoft },
  footer: { padding: spacing.xl, gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.lineSoft },
  error: { ...typography.caption, color: colors.danger },
});
