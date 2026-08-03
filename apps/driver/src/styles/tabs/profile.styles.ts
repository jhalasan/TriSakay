import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.lg, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.h1, color: colors.ink },
  identity: { alignItems: 'center', gap: spacing.sm },
  editFieldWrap: { width: '100%' },
  name: { ...typography.h2, color: colors.ink },
  detailsCard: { flexDirection: 'row', gap: spacing.xl },
  detailCol: { flex: 1, gap: 2 },
  detailLabel: { ...typography.label, color: colors.inkSoft },
  detailValue: { ...typography.body, color: colors.ink },
  navGroup: { padding: 0 },
});
