import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1 },
  markReadText: { ...typography.caption, color: colors.accentBlue },
  error: { ...typography.caption, color: colors.danger, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  listContent: { padding: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  dotSlot: { width: 8, alignItems: 'center', paddingTop: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentBlue },
  textSlot: { flex: 1, gap: 2 },
  title: { ...typography.bodyStrong, color: colors.ink },
  body: { ...typography.body, color: colors.inkSoft },
  date: { ...typography.caption, color: colors.inkFaint },
});
