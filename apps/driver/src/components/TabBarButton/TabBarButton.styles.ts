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
  // Matches passenger's activeMarker exactly (apps/passenger/app/(tabs)/_layout.tsx)
  // — same tab bar paddingTop/borderTopWidth on both apps, so the same -5
  // offset lands this flush on the bar's real top edge on both.
  marker: {
    position: 'absolute',
    top: -5,
    alignSelf: 'center',
    width: 22,
    height: 3,
    borderRadius: 2, // literal — no matching radius token, matches passenger's own literal here
    backgroundColor: colors.accentBlue,
  },
});
