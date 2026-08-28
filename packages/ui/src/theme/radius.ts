import { Dimensions } from 'react-native';
import { moderateScale } from './scale';

const deviceWidth = Dimensions.get('window').width;

export const radius = {
  sm: moderateScale(8, deviceWidth),
  md: moderateScale(12, deviceWidth),
  card: moderateScale(16, deviceWidth),
  lg: moderateScale(20, deviceWidth),
  sheetTop: moderateScale(28, deviceWidth),
  // TriSakay Home redesign steps not covered by the names above.
  xs: moderateScale(11, deviceWidth),
  sm2: moderateScale(14, deviceWidth),
  md3: moderateScale(18, deviceWidth),
  lg2: moderateScale(22, deviceWidth),
  xl2: moderateScale(24, deviceWidth),
  /** The full-bleed hero surface's bottom-corner radius — named for what it's for, not its number, since it's a one-off structural value rather than a general step. */
  heroBottom: moderateScale(30, deviceWidth),
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radius;
