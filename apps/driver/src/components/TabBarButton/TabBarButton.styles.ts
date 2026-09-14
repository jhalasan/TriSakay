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
  // Deliberately a dot, not passenger's activeMarker bar shape
  // (apps/passenger/app/(tabs)/_layout.tsx) — driver-side-only per request.
  marker: {
    position: 'absolute',
    top: -4,
    alignSelf: 'center',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentBlue,
  },
});
