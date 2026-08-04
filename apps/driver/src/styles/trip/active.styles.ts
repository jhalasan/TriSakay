import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  mapWrap: { height: 260 },
  statusBadgeWrap: { position: 'absolute', top: spacing.xxl, left: spacing.lg },
  content: { flex: 1, padding: spacing.lg, gap: spacing.lg },
  passengerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  passengerName: { ...typography.bodyStrong, color: colors.ink },
  seatsLabel: { ...typography.caption, color: colors.inkSoft },
  cashCard: {
    gap: spacing.sm,
  },
  cashRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cashLabel: { ...typography.bodyStrong, color: colors.ink },
  cashCaption: { ...typography.caption, color: colors.inkSoft },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: 'auto', paddingTop: spacing.lg },
  actionButton: { flex: 1 },
  error: { ...typography.caption, color: colors.danger },
});
