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
  barToday: {
    backgroundColor: colors.accentGreen,
  },
  barValue: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 14,
    color: colors.inkSoft,
  },
  barLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: typography.body.fontFamily,
    color: colors.inkFaint,
  },
  barLabelToday: {
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.ink,
  },
});
