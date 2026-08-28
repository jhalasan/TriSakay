import { Dimensions } from 'react-native';
import { moderateScale } from './scale';

const deviceWidth = Dimensions.get('window').width;

export const spacing = {
  xs: moderateScale(4, deviceWidth),
  sm: moderateScale(8, deviceWidth),
  md: moderateScale(12, deviceWidth),
  lg: moderateScale(16, deviceWidth),
  xl: moderateScale(24, deviceWidth),
  xxl: moderateScale(32, deviceWidth),
  xxxl: moderateScale(48, deviceWidth),
  // Fine-grained steps used by the TriSakay Home redesign (see
  // docs/design_handoff_trisakay_home/README.md § Design Tokens). Named
  // `tightN` rather than the raw px value since these sit between the
  // semantic steps above, not replacing them.
  tight2: moderateScale(2, deviceWidth),
  tight6: moderateScale(6, deviceWidth),
  tight10: moderateScale(10, deviceWidth),
  tight14: moderateScale(14, deviceWidth),
  tight18: moderateScale(18, deviceWidth),
  tight22: moderateScale(22, deviceWidth),
  tight26: moderateScale(26, deviceWidth),
  tight34: moderateScale(34, deviceWidth),
  tight44: moderateScale(44, deviceWidth),
} as const;

export type SpacingToken = keyof typeof spacing;
