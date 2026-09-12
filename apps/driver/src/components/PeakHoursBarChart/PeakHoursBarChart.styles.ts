import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    padding: spacing.xs,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  barTrack: {
    width: '55%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 6,
  },
  barPast: {
    backgroundColor: colors.accentBlueSoft,
  },
  barPeak: {
    backgroundColor: colors.accentGreen,
  },
  barLabel: {
    fontSize: 8,
    lineHeight: 11,
    fontFamily: typography.body.fontFamily,
    color: colors.inkFaint,
    textAlign: 'center',
  },
  barLabelPeak: {
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.ink,
  },
});
