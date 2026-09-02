import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  // Same split as home.styles.ts's heroShadowWrap/heroPanel — never put an
  // elevation shadow on the same view as overflow:'hidden' + borderRadius.
  heroShadowWrap: {
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 10,
  },
  heroPanel: {
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: radius.heroBottom,
    borderBottomRightRadius: radius.heroBottom,
    paddingHorizontal: spacing.tight18,
    paddingTop: spacing.sm,
    paddingBottom: spacing.tight22,
  },
  heroMotif: {
    position: 'absolute',
    top: -46,
    right: -52,
  },
  heroEyebrow: {
    ...typography.eyebrow,
    color: colors.white,
    opacity: 0.75,
  },
  heroTitle: {
    ...typography.h1b,
    color: colors.white,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  filterPill: {
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  filterPillActive: {
    backgroundColor: colors.white,
    borderColor: colors.white,
  },
  filterPillLabel: {
    ...typography.bodyStrong,
    fontSize: 13,
    color: colors.white,
  },
  filterPillLabelActive: {
    color: colors.accentBlue,
  },

  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },

  monthRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  monthLabel: {
    ...typography.label,
    color: colors.inkSoft,
  },
  monthSummary: {
    ...typography.caption,
    color: colors.inkFaint,
  },

  rideCard: {
    gap: spacing.md,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dateTimeText: {
    ...typography.caption,
    color: colors.inkFaint,
  },
  topRowTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fareText: {
    ...typography.h3,
    color: colors.ink,
  },
  fareTextCancelled: {
    color: colors.inkFaint,
  },

  routeBlock: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  routeMarkerCol: {
    alignItems: 'center',
    width: 10,
    paddingTop: 2,
  },
  routeDotPickup: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2.5,
    borderColor: colors.accentGreen,
  },
  routeDotDropoff: {
    width: 9,
    height: 9,
    borderRadius: 2,
    backgroundColor: colors.accentBlue,
  },
  routeLine: {
    flex: 1,
    minHeight: spacing.lg,
    width: 2,
    backgroundColor: colors.line,
    marginVertical: 3,
  },
  routeTextCol: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
    justifyContent: 'center',
  },
  routeAddress: {
    ...typography.bodyStrong,
    fontSize: 14,
    color: colors.ink,
  },

  cancelledRouteText: {
    ...typography.bodyStrong,
    fontSize: 14,
    color: colors.ink,
  },
  cancelledReasonText: {
    ...typography.body,
    fontSize: 13,
    color: colors.inkSoft,
  },

  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  driverIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  driverName: {
    ...typography.caption,
    color: colors.inkSoft,
  },

  // Loading skeleton — same 1.4s pulse as the finding-driver beacon
  // (motion.duration.pulse), rows fading 100/100/72/45% down the list.
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  skeletonAvatar: {
    width: 42,
    height: 42,
    borderRadius: radius.sm2,
  },
  skeletonTextCol: {
    flex: 1,
    gap: spacing.sm,
  },
  skeletonBlock: {
    backgroundColor: '#E4E8EC',
    borderRadius: 7,
  },
  skeletonMonthLabel: {
    width: 120,
    height: 12,
    marginBottom: spacing.xs,
  },

  emptyWrap: {
    padding: spacing.xxl,
  },
  emptyPanel: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyMotif: {
    position: 'absolute',
    top: -20,
    right: -20,
  },
  emptyIconTile: {
    width: 46,
    height: 46,
    borderRadius: radius.sm2,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.ink,
  },
  emptyMessage: {
    ...typography.caption,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  emptyButton: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
  },
});
