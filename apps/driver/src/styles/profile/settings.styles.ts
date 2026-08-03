import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  rowLabel: { ...typography.body, color: colors.ink },
  rowValueSlot: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowValue: { ...typography.body, color: colors.inkSoft },
  logoutWrap: { marginTop: spacing.xl },
});
