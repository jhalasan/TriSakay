import { Dimensions, StyleSheet } from 'react-native';
import { colors, elevation, moderateScale, radius, spacing, typography } from '@trisakay/ui';

const deviceWidth = Dimensions.get('window').width;
const scale = (value: number) => moderateScale(value, deviceWidth);

export const MAP_BAND_HEIGHT = scale(516);
export const DOT_INACTIVE_WIDTH = scale(8);
export const DOT_ACTIVE_WIDTH = scale(22);

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  slide: {
    flex: 1,
  },
  mapBand: {
    height: MAP_BAND_HEIGHT,
    overflow: 'hidden',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: scale(8),
    paddingHorizontal: scale(24),
    zIndex: 2,
  },
  counter: {
    ...typography.label,
    color: colors.inkSoft,
  },
  skip: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  skipLabel: {
    ...typography.buttonSmall,
    color: colors.accentBlue,
  },
  skipHidden: {
    opacity: 0,
  },
  illustrationArea: {
    flex: 1,
  },
  sheet: {
    flex: 1,
    marginTop: -scale(28),
    borderTopLeftRadius: radius.sheetTop,
    borderTopRightRadius: radius.sheetTop,
    backgroundColor: colors.white,
    paddingTop: scale(26),
    paddingHorizontal: scale(24),
    ...elevation.sheet,
  },
  headline: {
    ...typography.display,
    color: colors.ink,
  },
  body: {
    ...typography.body,
    color: colors.inkSoft,
    marginTop: spacing.sm,
  },
  ctaRow: {
    marginTop: 'auto',
    paddingBottom: scale(14),
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: scale(22),
  },
  dot: {
    height: DOT_INACTIVE_WIDTH,
    borderRadius: radius.pill,
    backgroundColor: colors.line,
  },
});
