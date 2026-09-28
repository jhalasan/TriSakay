import { StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';

export const styles = StyleSheet.create({
  /**
   * Shadow lives on this outer, non-clipping wrapper — a sibling view with
   * `overflow: hidden` (needed to clip content while the sheet is dragged
   * short) would also clip its own shadow on iOS. Sizes to `sheet` below,
   * its only child.
   */
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
  sheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: 26, // literal — no matching radius token, see docs/design_handoff_trisakay_passenger/PHASE0_NOTES.md
    borderTopRightRadius: 26,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    overflow: 'hidden',
  },
  /** Enlarges the handle's touch target well past its visible 40x4 pill — a drag handle this small is unusable to grab otherwise. */
  handleTouchArea: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  /**
   * Plain neutral grip, not the brand gradient — a drag handle is chrome,
   * not a branded surface. Sized up from the original 40x4 and using
   * `lineStrong` (the control-boundary token) instead of the decorative-only
   * `line` — that subtle a bar against the sheet's own background read as
   * decorative, not draggable, in UAT feedback.
   */
  handle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.lineStrong,
  },
  content: {
    gap: spacing.md,
  },
});
