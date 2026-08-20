import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  /**
   * Absolute-fill on purpose: this must ignore the SafeAreaView's own top
   * inset padding so the map itself runs edge-to-edge including behind the
   * status bar — only the floating header above it respects the inset, via
   * its normal in-flow position. Matches Home/set-destination/set-pickup.
   */
  mapFill: {
    ...StyleSheet.absoluteFillObject,
  },
  topFloating: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  /** A solid card rather than bare text over the map — floating text on OSM tiles is illegible against light basemap areas. */
  headerCard: {
    padding: spacing.sm,
    borderTopWidth: 3,
    borderTopColor: colors.accentGreen,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentBlueSoft,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.ink,
    flex: 1,
  },
  pickupDivider: {
    height: 1,
    backgroundColor: colors.lineSoft,
    marginVertical: spacing.xs,
  },
  locationErrorText: {
    ...typography.caption,
    color: colors.danger,
    paddingHorizontal: spacing.xs,
    marginTop: -spacing.xs,
  },
  currentLocationButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentGreenSoft,
  },
  bottomFloating: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
