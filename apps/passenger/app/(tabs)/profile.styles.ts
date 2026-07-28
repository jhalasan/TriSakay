import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.ink,
  },
  identity: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    ...typography.h2,
    color: colors.ink,
    marginTop: spacing.sm,
  },
  editFieldWrap: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },
  detailsCard: {
    flexDirection: 'row',
  },
  detailCol: {
    flex: 1,
    gap: 2,
  },
  detailLabel: {
    ...typography.label,
    color: colors.inkSoft,
  },
  detailValue: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  navGroup: {
    gap: spacing.xs,
  },
});
