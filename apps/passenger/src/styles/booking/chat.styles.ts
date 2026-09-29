import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex1: { flex: 1 },
  listContent: { padding: spacing.lg, paddingBottom: spacing.md, flexGrow: 1, justifyContent: 'flex-end' },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  error: { ...typography.caption, color: colors.danger, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
});
