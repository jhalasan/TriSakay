import { StyleSheet } from 'react-native';
import { fontFamily, radius } from '@trisakay/ui';

export const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  label: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: fontFamily.bold,
  },
});
