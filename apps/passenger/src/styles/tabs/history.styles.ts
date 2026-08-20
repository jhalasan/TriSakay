import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.h1,
    color: colors.ink,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
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
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  fareText: {
    ...typography.h2,
    color: colors.ink,
  },

  routeBlock: {
    gap: 2,
  },
  routeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  routeMarkerCol: {
    alignItems: 'center',
    width: 10,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  routeDotPickup: {
    backgroundColor: colors.accentBlue,
  },
  routeDotDropoff: {
    backgroundColor: colors.accentGreen,
  },
  routeLine: {
    flex: 1,
    minHeight: spacing.lg,
    width: 2,
    backgroundColor: colors.line,
    marginVertical: 2,
  },
  routeTextCol: {
    flex: 1,
    paddingBottom: spacing.sm,
  },
  routeLabel: {
    ...typography.label,
    fontSize: 10,
    color: colors.inkFaint,
  },
  routeAddress: {
    ...typography.body,
    color: colors.ink,
  },

  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  driverName: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
});
