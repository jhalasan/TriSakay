import { StyleSheet } from 'react-native';
import { colors, radius } from '@trisakay/ui';

export const styles = StyleSheet.create({
  // Shadow lives on this outer wrapper, not on the GradientSurface itself —
  // GradientSurface sets overflow:'hidden', and combining that with a radius
  // + elevation shadow on Android bleeds the shadow past the rounded corners.
  shadowWrap: {
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 10,
  },
  panel: {
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: radius.heroBottom,
    borderBottomRightRadius: radius.heroBottom,
  },
  motif: {
    position: 'absolute',
    top: -30,
    right: -34,
  },
});
