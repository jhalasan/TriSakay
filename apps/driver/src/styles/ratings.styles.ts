import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  listContent: { padding: spacing.lg, gap: spacing.sm },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { ...typography.caption, color: colors.inkSoft },
  comment: { ...typography.body, color: colors.ink },
  error: { ...typography.caption, color: colors.danger, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
});
