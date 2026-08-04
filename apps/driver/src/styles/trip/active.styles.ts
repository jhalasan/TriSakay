import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  mapFill: { ...StyleSheet.absoluteFillObject },
  statusBadgeWrap: { position: 'absolute', top: spacing.xxl, left: spacing.lg },
  content: { gap: spacing.lg },
  passengerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  passengerName: { ...typography.bodyStrong, color: colors.ink },
  seatsLabel: { ...typography.caption, color: colors.inkSoft },
  cashCard: {
    gap: spacing.sm,
  },
  cashRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cashLabel: { ...typography.bodyStrong, color: colors.ink },
  cashCaption: { ...typography.caption, color: colors.inkSoft },
  actions: { flexDirection: 'row', gap: spacing.md },
  actionButton: { flex: 1 },
  error: { ...typography.caption, color: colors.danger },
});
