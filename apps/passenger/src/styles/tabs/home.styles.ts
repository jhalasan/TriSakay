import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  /**
   * Absolute-fill on purpose: this must ignore the SafeAreaView's own top/
   * bottom inset padding so the map itself runs edge-to-edge including
   * behind the status bar — only the floating controls above it respect
   * the inset, via their normal in-flow position.
   */
  mapFill: {
    ...StyleSheet.absoluteFillObject,
  },
  topFloating: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  /**
   * A solid card rather than bare text over the map: floating text directly
   * on OSM tiles was illegible against light basemap areas regardless of
   * text-shadow tricks. Avatar, search, and bell share one row so the panel
   * reads as a single "control tower" rather than stacked pieces.
   */
  headerCard: {
    padding: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerSearchBar: {
    flex: 1,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.panel,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.inkSoft,
    marginBottom: spacing.md,
  },
  shortcuts: {
    gap: spacing.md,
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.fill,
    minHeight: 68,
  },
  shortcutIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutTextSlot: {
    flex: 1,
    gap: 2,
  },
  shortcutLabel: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  shortcutAddress: {
    ...typography.caption,
    color: colors.inkSoft,
  },
});
