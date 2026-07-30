import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.lineStrong, // icon-only control
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchField: {
    flex: 1,
  },
  mapWrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  resultsLabel: {
    ...typography.label,
    color: colors.inkSoft,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  resultsList: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultIconSelected: {
    backgroundColor: colors.accentBlueSoft,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    backgroundColor: colors.panel,
  },
});
