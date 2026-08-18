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
} as const;

export type SpacingToken = keyof typeof spacing;
