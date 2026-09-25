import { StyleSheet } from 'react-native';
import { colors, fontFamily, elevation, radius, spacing, typography } from '../../theme';

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
  /** Square corners for full-bleed maps that run to the screen edges — a rounded corner there reads as an accidental gap, not a card. */
  edgeToEdge: {
    borderRadius: 0,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.fill,
  },
  /** Teardrop pin body — matches the old Leaflet divIcon's rotated rounded-square shape. */
  pinWrap: {
    alignItems: 'center',
  },
  pinBody: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderBottomLeftRadius: 2,
    transform: [{ rotate: '-45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#002e60',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  pinDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#fff',
    transform: [{ rotate: '45deg' }],
  },
  pinShadow: {
    width: 13,
    height: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(0,26,56,0.28)',
    marginTop: 5,
  },
  /** Live driver dot — matches the old 22px filled-circle driver icon. */
  driverDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accentGreen,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  /** Route start/end dot — matches the old Leaflet circleMarker endpoints. */
  routeDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  skeleton: {
    ...StyleSheet.absoluteFillObject,
  },
  labelChip: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: 14,
    backgroundColor: 'rgba(20,25,29,0.82)',
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  labelText: {
    ...typography.chip,
    color: colors.white,
    fontFamily: fontFamily.semibold,
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
