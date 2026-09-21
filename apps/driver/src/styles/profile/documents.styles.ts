import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.lg, gap: spacing.md },
  subtitle: { ...typography.caption, fontSize: 13, color: colors.inkSoft, marginBottom: spacing.xs },
  error: { ...typography.body, color: colors.danger },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  fieldWrap: {
    flex: 1,
  },
});
