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
  // top:-5 (not 0) lands this flush on the tab bar's actual top hairline
  // rather than a few px below it — same positioning as the passenger
  // app's activeMarker (apps/passenger/app/(tabs)/_layout.tsx).
  marker: {
    position: 'absolute',
    top: -5,
    alignSelf: 'center',
    width: 22,
    height: 3,
    borderRadius: 2, // literal — no matching radius token
    backgroundColor: colors.accentBlue,
  },
});
