import { StyleSheet } from 'react-native';
import { colors, radius, typography } from '../../theme';

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', marginVertical: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  text: { ...typography.body, fontSize: 12, lineHeight: 16, color: colors.inkSoft },
});
