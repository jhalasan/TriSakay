import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapFill: {
    ...StyleSheet.absoluteFillObject,
  },
  statusBadgeWrap: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.lg,
  },
  /** Floats over the bottom of the full-bleed map instead of sitting below it in normal flow — paddingBottom is finished off at the call site with the safe-area inset. */
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.panel,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    ...elevation.sheet,
  },
  /** A brand-gradient handle bar rather than a plain grey one — the same small threading device carried through finding-driver → trip. */
  sheetAccent: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  caption: {
    ...typography.caption,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  sosBlock: {
    gap: spacing.xs,
    alignItems: 'center',
  },
  sosCaption: {
    ...typography.caption,
    color: colors.inkSoft,
    textAlign: 'center',
  },
});
