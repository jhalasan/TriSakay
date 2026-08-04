import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.lg, gap: spacing.lg },
  title: { ...typography.h1, color: colors.ink },
  totalCard: {
    gap: spacing.xs,
  },
  totalLabel: { ...typography.label, color: colors.inkSoft },
  totalValue: { ...typography.amount, color: colors.ink },
  sectionLabel: { ...typography.label, color: colors.inkSoft, marginTop: spacing.sm },
  logRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  logTextSlot: { gap: 2 },
  logAmount: { ...typography.body, color: colors.ink },
  logDate: { ...typography.caption, color: colors.inkSoft },
  caption: { ...typography.caption, color: colors.inkSoft, textAlign: 'center' },
});
