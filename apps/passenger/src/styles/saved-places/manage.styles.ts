import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h2, color: colors.ink },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.tight10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight14,
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.tight14,
    backgroundColor: colors.white,
    minHeight: 70,
  },
  icon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  textSlot: { flex: 1, gap: 2 },
  label: { ...typography.bodyStrong, color: colors.ink },
  address: { ...typography.caption, color: colors.inkSoft },
  removeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
