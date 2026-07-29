import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '../../theme';

/** Recenter control. 44pt minimum touch target (see PRODUCT.md accessibility). */
export const RECENTER_SIZE = 44;

export const styles = StyleSheet.create({
  /**
   * Mirrors MapPlaceholder's container exactly: height comes from the prop and
   * there is deliberately NO flex. `trip-in-progress` passes height="100%" as a
   * direct child of a flex:1 View with no wrapper, while the ScrollView call
   * sites would collapse under flex:1 — absolute-fill children satisfy both.
   */
  container: {
    overflow: 'hidden',
    backgroundColor: colors.fill,
    borderRadius: radius.md,
  },
  webview: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.fill,
  },
  skeleton: {
    ...StyleSheet.absoluteFillObject,
  },
  labelChip: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -16,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  labelText: {
    ...typography.caption,
    color: colors.inkSoft,
    fontWeight: '600',
  },
  offlineChip: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: spacing.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  offlineText: {
    ...typography.caption,
    color: colors.inkSoft,
  },
  /**
   * Position only. The side and `bottom` are applied inline, because only the
   * call site knows what covers the map's bottom edge (`bottomInset`) and which
   * corner the OSM attribution took (`attributionLeft`). The rule this encodes:
   * recenter always sits opposite the attribution, both lifted clear of the
   * overlay.
   */
  recenterButton: {
    position: 'absolute',
  },
  /**
   * The visual lives on the Pressable rather than the wrapper so the press scale
   * shrinks the whole circle — on the wrapper it would shrink only the icon
   * inside a static ring.
   *
   * `elevation.card` plus a border, not `elevation.sheet`: sheet's shadow points
   * upward for bottom sheets and reads as a smudge under a small round button,
   * and the border is what guarantees an edge against arbitrary map imagery.
   */
  recenterPressable: {
    width: RECENTER_SIZE,
    height: RECENTER_SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    ...elevation.card,
  },
});
