import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.fill,
  },
  mapFill: {
    ...StyleSheet.absoluteFillObject,
  },
  topFloating: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: radius.sm2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fill,
  },
  title: {
    ...typography.h2,
    color: colors.ink,
  },
  cause: {
    ...typography.body,
    color: colors.inkSoft,
  },
  summaryPanel: {
    backgroundColor: colors.bg,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    ...typography.body,
    color: colors.inkSoft,
  },
  summaryValue: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.line,
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  discountText: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  primaryButton: {
    marginTop: spacing.xs,
  },
});
