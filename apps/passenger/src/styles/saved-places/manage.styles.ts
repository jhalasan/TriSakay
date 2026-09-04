import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.tight10 },
  intro: { ...typography.caption, color: colors.inkSoft, marginBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight14,
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.tight14,
    backgroundColor: colors.white,
    minHeight: 70,
    ...elevation.card,
  },
  icon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  textSlot: { flex: 1, gap: 2 },
  label: { ...typography.bodyStrong, color: colors.ink },
  address: { ...typography.caption, color: colors.inkSoft },
  removeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingVertical: spacing.lg,
    marginTop: spacing.xs,
  },
  addRowLabel: { ...typography.bodyStrong, color: colors.accentBlue },
});
