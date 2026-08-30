import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  /** Ignores the SafeAreaView's own inset padding so the map runs edge-to-edge, including behind the status bar. */
  mapFill: {
    ...StyleSheet.absoluteFillObject,
  },
  topFloating: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  // Compact live-preview under the search bar — a few short rows at most, so
  // it never eats into the map the way a full results panel would. Only for
  // "am I typing the right place" confirmation; the full list with details
  // stays in the bottom sheet.
  //
  // Shadow lives on this outer wrapper, never on the same view as
  // overflow:'hidden' + borderRadius — combining them on Android makes the
  // elevation shadow render as an unclipped rectangle bleeding past the
  // rounded corners (see the identical note on ctaCardShadowWrap in
  // tabs/home.styles.ts).
  suggestStripShadowWrap: {
    borderRadius: radius.card,
    backgroundColor: colors.panel,
    marginTop: spacing.sm,
    ...elevation.card,
  },
  suggestStrip: {
    borderRadius: radius.card,
    overflow: 'hidden',
    paddingVertical: spacing.xs,
  },
  suggestHint: {
    ...typography.caption,
    color: colors.inkSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xl,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  suggestRowFirst: {
    borderTopWidth: 0,
  },
  suggestRowTextSlot: {
    flex: 1,
    gap: 1,
  },
  suggestRowTitle: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  suggestRowAddress: {
    ...typography.caption,
    color: colors.inkSoft,
  },
  resultsLabel: {
    ...typography.label,
    color: colors.inkSoft,
    marginBottom: spacing.xs,
  },
  statusHint: {
    ...typography.caption,
    color: colors.inkSoft,
    marginBottom: spacing.xs,
  },
  resultsList: {
    maxHeight: 220,
    marginBottom: spacing.md,
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
  currentLocationIcon: {
    backgroundColor: colors.accentBlueSoft,
  },
});
