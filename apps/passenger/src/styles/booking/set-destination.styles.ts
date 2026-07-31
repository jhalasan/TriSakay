import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

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
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.card,
  },
  searchField: {
    flex: 1,
  },
  // Shadow and clipping split across two views: overflow:'hidden' would
  // clip the shadow itself if it lived on the same view that carries it.
  mapWrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    ...elevation.card,
  },
  mapInner: {
    borderRadius: radius.md,
    overflow: 'hidden',
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
