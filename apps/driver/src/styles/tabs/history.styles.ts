import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  title: { ...typography.h1, color: colors.ink },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  trailingSlot: { alignItems: 'flex-end', gap: spacing.xs },
  fareText: { ...typography.bodyStrong, color: colors.ink },
});
