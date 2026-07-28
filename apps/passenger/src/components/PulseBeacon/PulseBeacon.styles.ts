import { StyleSheet } from 'react-native';
import { colors } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: colors.accentBlue,
  },
  core: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.accentBlue,
  },
});
