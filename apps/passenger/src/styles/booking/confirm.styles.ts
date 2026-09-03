import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentBlueSoft,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.ink,
    flex: 1,
  },
  /** Caps the sheet's scrollable content so a generous strip of map stays visible above it. */
  sheetScroll: {
    maxHeight: 440,
  },
  sheetScrollContent: {
    gap: spacing.xl,
    paddingBottom: spacing.md,
  },
  routeCard: {
    gap: spacing.md,
    borderColor: colors.lineSoft,
    borderRadius: radius.md3,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  routeIconBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeTextSlot: {
    flex: 1,
    gap: 2,
  },
  routeEyebrow: {
    ...typography.labelSm,
    color: colors.inkSoft,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  routeLabel: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  routeChangeLink: {
    ...typography.buttonSmall,
    color: colors.accentBluePressed,
  },
  routeDivider: {
    height: 1,
    backgroundColor: colors.lineSoft,
    marginLeft: 44,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    ...typography.label,
    color: colors.inkSoft,
  },
  sectionLabelSpaced: {
    ...typography.label,
    color: colors.inkSoft,
    marginBottom: spacing.md,
  },
  /** The fare is the number the rider is looking for — the spec gives it the system's navy panel, not a white card. */
  fareCard: {
    gap: spacing.xs,
    backgroundColor: colors.accentBlue,
    borderColor: 'transparent',
    paddingVertical: spacing.xl,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  fareMotif: {
    position: 'absolute',
    top: -30,
    right: -26,
  },
  fareLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  fareLabelWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  fareLabel: {
    ...typography.label,
    color: colors.white,
    opacity: 0.75,
  },
  fareValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  fareValue: {
    ...typography.amount,
    color: colors.white,
  },
  fareDistance: {
    ...typography.caption,
    color: colors.white,
    opacity: 0.7,
  },
  fareNote: {
    ...typography.caption,
    color: colors.white,
    opacity: 0.75,
  },
  discountLink: {
    ...typography.caption,
    color: colors.white,
    textDecorationLine: 'underline',
    marginTop: spacing.xs,
  },
  requestButtonIcon: {
    width: 22,
    height: 22,
  },
  requestError: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  footer: {
    gap: spacing.xs,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.inkSoft,
    textAlign: 'center',
  },
});
