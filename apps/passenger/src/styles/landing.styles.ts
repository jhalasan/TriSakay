import { Dimensions, StyleSheet } from 'react-native';
import { colors, moderateScale, spacing, typography } from '@trisakay/ui';

const deviceWidth = Dimensions.get('window').width;
const scale = (value: number) => moderateScale(value, deviceWidth);

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  motif: {
    position: 'absolute',
    top: -scale(100),
    right: -scale(160),
  },
  header: {
    paddingTop: scale(36),
    paddingHorizontal: scale(32),
  },
  logo: {
    width: scale(150),
    height: scale(84),
  },
  headline: {
    ...typography.displayLg,
    color: colors.ink,
    marginTop: spacing.lg,
  },
  headlineAccent: {
    color: colors.accentGreen,
  },
  body: {
    ...typography.body,
    color: colors.inkSoft,
    marginTop: spacing.sm,
  },
  trikeBand: {
    flex: 1,
    overflow: 'hidden',
  },
  trikeImage: {
    position: 'absolute',
    bottom: scale(14),
    alignSelf: 'center',
    width: scale(300),
    height: scale(240),
  },
  actions: {
    paddingHorizontal: scale(32),
    paddingBottom: scale(24),
    gap: spacing.md,
  },
});
