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
  },
  core: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.34,
    shadowRadius: 24,
    elevation: 10,
  },
});
