import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.lg, gap: spacing.lg },
  title: { ...typography.h1, color: colors.ink },
  totalCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.lg,
    backgroundColor: colors.panel,
    gap: spacing.xs,
  },
  totalLabel: { ...typography.label, color: colors.inkSoft },
  totalValue: { ...typography.amount, color: colors.ink },
  sectionLabel: { ...typography.label, color: colors.inkSoft, marginTop: spacing.sm },
  logRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  logAmount: { ...typography.body, color: colors.ink },
  caption: { ...typography.caption, color: colors.inkSoft, textAlign: 'center' },
});
