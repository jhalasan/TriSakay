import { StyleSheet } from 'react-native';
import { colors, fontFamily } from '../../theme';

export const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentBlueSoft,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  initials: {
    color: colors.accentBluePressed,
    fontFamily: fontFamily.bold,
  },
});
