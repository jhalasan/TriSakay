import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  mapFill: { ...StyleSheet.absoluteFillObject },
  statusBadgeWrap: { position: 'absolute', top: spacing.xxl, left: spacing.lg },
  content: { gap: spacing.lg },
  passengerScroll: { flexShrink: 1 },
  passengerScrollContent: { gap: spacing.lg, paddingBottom: spacing.xs },
  passengerCard: { gap: spacing.sm },
  passengerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  passengerName: { ...typography.bodyStrong, color: colors.ink },
  seatsLabel: { ...typography.caption, color: colors.inkSoft },
  cashRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cashLabel: { ...typography.bodyStrong, color: colors.ink },
  cashCaption: { ...typography.caption, color: colors.inkSoft },
  actions: { flexDirection: 'row', gap: spacing.md },
  actionButton: { flex: 1 },
  error: { ...typography.caption, color: colors.danger },
  sosBlock: { gap: spacing.xs, alignItems: 'center' },
  sosCaption: { ...typography.caption, color: colors.inkSoft },
  sectionLabel: { ...typography.label, color: colors.inkSoft, marginTop: spacing.sm },
});
