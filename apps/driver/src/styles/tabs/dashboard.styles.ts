import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

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
  error: { ...typography.caption, color: colors.danger },
  bellButton: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
    ...elevation.card,
  },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.panel,
  },
});
