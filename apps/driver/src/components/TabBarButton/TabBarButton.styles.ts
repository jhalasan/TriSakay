import { StyleSheet } from 'react-native';
import { colors } from '@trisakay/ui';

export const styles = StyleSheet.create({
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  buttonPressed: {
    backgroundColor: colors.fill,
  },
  marker: {
    position: 'absolute',
    top: 0,
    left: '50%',
    marginLeft: -11,
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accentBlue,
  },
});
