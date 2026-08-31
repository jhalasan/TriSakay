import { Dimensions, StyleSheet } from 'react-native';
import { colors, elevation, moderateScale, radius, typography } from '@trisakay/ui';

const deviceWidth = Dimensions.get('window').width;
const scale = (value: number) => moderateScale(value, deviceWidth);

export const LOADING_BAR_WIDTH = scale(120);
export const MARKER_SIZE = scale(64);
export const MARKER_ICON_SIZE = scale(44);
export const HALO_SIZE = scale(84);

export const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  illustration: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingTop: scale(28),
    paddingHorizontal: scale(32),
    paddingBottom: scale(24),
    alignItems: 'center',
    ...elevation.floatingCard,
  },
  logo: {
    width: scale(196),
    height: scale(110),
  },
  driverBadge: {
    marginTop: scale(6),
    paddingVertical: scale(6),
    paddingHorizontal: scale(16),
    borderRadius: radius.pill,
    backgroundColor: `${colors.accentGreen}1A`,
  },
  driverBadgeText: {
    ...typography.eyebrow,
    letterSpacing: 4,
    color: colors.accentGreen,
  },
  tagline: {
    ...typography.body,
    color: colors.inkSoft,
    marginTop: scale(14),
  },

  // The marker circle's shadow doesn't match any existing `elevation.*`
  // token (0/8/22/.18 vs. the closest, `pin`, at 0/4/10/.24) — inlined here
  // rather than adding a new token for one screen's use.
  markerHost: {
    position: 'absolute',
  },
  halo: {
    position: 'absolute',
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
    backgroundColor: colors.accentGreen,
  },
  // Shadow lives on this outer wrapper, never on the same view as
  // overflow:'hidden' + borderRadius — combining them on Android makes the
  // elevation shadow render as an unclipped rectangle that bleeds past the
  // rounded corners (see dashboard.styles.ts's listeningPanelShadowWrap).
  markerShadowWrap: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 6,
  },
  marker: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerIcon: {
    width: MARKER_ICON_SIZE,
    height: MARKER_ICON_SIZE,
  },

  loadingBar: {
    position: 'absolute',
    bottom: scale(64),
    alignSelf: 'center',
    width: LOADING_BAR_WIDTH,
    height: scale(3),
    borderRadius: radius.pill,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  loadingIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: radius.pill,
    backgroundColor: colors.accentGreen,
  },
});
