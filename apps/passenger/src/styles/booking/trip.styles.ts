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
  // Floats over the bottom of the full-bleed map instead of sitting below it
  // in normal flow — paddingBottom is finished off at the call site with the
  // safe-area inset. Shadow lives on this outer wrapper (no background,
  // no overflow:'hidden' here) — the GradientSurface below carries the fill
  // and clips to the same radius; combining a shadow with overflow:'hidden'
  // on the same view bleeds an unclipped rectangle past the rounded corners
  // on Android (same caveat as home.styles.ts's heroShadowWrap).
  sheetShadowWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: -14 },
    shadowOpacity: 0.16,
    shadowRadius: 36,
    elevation: 12,
  },
  // The spec makes the whole sheet the navy textured surface once a driver
  // is assigned, not just a thin accent bar on an otherwise white sheet.
  sheet: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
    borderTopLeftRadius: 26, // literal — no matching radius token, see PHASE0_NOTES.md
    borderTopRightRadius: 26,
  },
  /** Neutral grip against the navy fill — not the brand gradient, which reads as noise on a chrome element. */
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  caption: {
    ...typography.caption,
    color: colors.white,
    opacity: 0.75,
    textAlign: 'center',
  },
  error: {
    ...typography.caption,
    color: colors.dangerSoft, // plain colors.danger is too close to the navy fill to read
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
    color: colors.white,
    opacity: 0.75,
    textAlign: 'center',
  },
});
