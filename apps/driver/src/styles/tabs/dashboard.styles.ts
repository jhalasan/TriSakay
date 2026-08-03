import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.lg, gap: spacing.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  nameSlot: { flex: 1 },
  name: { ...typography.h2, color: colors.ink },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLabel: { ...typography.bodyStrong, color: colors.ink },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  sectionLabel: { ...typography.label, color: colors.inkSoft, marginTop: spacing.sm },
  offlineNote: { ...typography.caption, color: colors.inkSoft },
});
