import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  headerBlock: {
    gap: 2,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h1b,
    color: colors.ink,
  },
  tagline: {
    ...typography.caption,
    color: colors.inkSoft,
  },
  sectionLabel: {
    ...typography.label,
    fontSize: 11,
    color: colors.inkSoft,
    marginBottom: spacing.sm,
  },
  card: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
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
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextSlot: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  rowLabel: {
    ...typography.bodyStrong,
    fontSize: 15,
    color: colors.ink,
  },
  rowSubtitle: {
    ...typography.caption,
    fontSize: 12,
    color: colors.inkFaint,
  },
  rowValueSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowValue: {
    ...typography.bodyStrong,
    fontSize: 14,
    color: colors.inkSoft,
  },
  logoutWrap: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  versionFooter: {
    ...typography.caption,
    fontSize: 11,
    color: colors.inkFaint,
    textAlign: 'center',
  },
});
