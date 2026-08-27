import { Dimensions, StyleSheet } from 'react-native';
import { colors, elevation, moderateScale, radius, typography } from '@trisakay/ui';

const deviceWidth = Dimensions.get('window').width;
const scale = (value: number) => moderateScale(value, deviceWidth);

export const LOADING_BAR_WIDTH = scale(120);

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
    paddingVertical: scale(28),
    paddingHorizontal: scale(32),
    alignItems: 'center',
    ...elevation.floatingCard,
  },
  logo: {
    width: scale(196),
    height: scale(110),
  },
  subtitle: {
    ...typography.body,
    color: colors.inkSoft,
    marginTop: scale(12),
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
    left: 0,
    borderRadius: radius.pill,
    backgroundColor: colors.accentGreen,
  },
});
