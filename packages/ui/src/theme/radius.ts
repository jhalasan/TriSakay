import { Dimensions } from 'react-native';
import { moderateScale } from './scale';

const deviceWidth = Dimensions.get('window').width;

export const radius = {
  sm: moderateScale(8, deviceWidth),
  md: moderateScale(12, deviceWidth),
  lg: moderateScale(20, deviceWidth),
  // Never scaled down: this only exists to force a full pill/circle radius,
  // and must stay far larger than any element it's applied to at any width.
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radius;
