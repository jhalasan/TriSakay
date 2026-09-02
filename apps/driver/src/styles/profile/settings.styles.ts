import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.lg, gap: spacing.lg },
  subtitle: { ...typography.caption, fontSize: 13, color: colors.inkSoft, marginTop: 2, marginBottom: spacing.xs },
  sectionLabel: {
    ...typography.label,
    fontSize: 11,
    color: colors.inkSoft,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.md3,
    paddingHorizontal: spacing.lg,
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  rowLeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    minWidth: 0,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextSlot: { flex: 1, minWidth: 0 },
  rowLabel: { ...typography.bodySm, fontSize: 15, color: colors.ink },
  rowSublabel: { ...typography.caption, fontSize: 12, color: colors.inkFaint, marginTop: 1 },
  rowValueSlot: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowValue: { ...typography.bodySm, fontSize: 14, color: colors.inkSoft },
  logoutWrap: { gap: spacing.sm },
  versionLine: { ...typography.caption, fontSize: 11, color: colors.inkFaint, textAlign: 'center' },
});
