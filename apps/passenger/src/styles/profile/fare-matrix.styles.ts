import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    ...elevation.card,
    gap: spacing.xs,
  },
  ordinanceLabel: {
    ...typography.label,
    color: colors.inkSoft,
  },
  ordinanceValue: {
    ...typography.h2,
    color: colors.ink,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  ruleLabel: {
    ...typography.body,
    color: colors.inkSoft,
  },
  ruleValue: {
    ...typography.body,
    color: colors.ink,
    fontWeight: '600',
  },
  ruleDivider: {
    height: 1,
    backgroundColor: colors.line,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.inkSoft,
    marginBottom: spacing.xs,
  },
  bodyText: {
    ...typography.body,
    color: colors.ink,
  },
  discountLink: {
    ...typography.body,
    color: colors.accentBlue,
    marginTop: spacing.xs,
  },
  disclaimer: {
    ...typography.caption,
    color: colors.inkFaint,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
  },
  badgeRow: {
    flexDirection: 'row',
    borderRadius: radius.sm,
  },
});
