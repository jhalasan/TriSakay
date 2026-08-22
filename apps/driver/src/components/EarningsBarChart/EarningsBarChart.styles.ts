import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    padding: spacing.md,
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
    backgroundColor: colors.accentGreen,
  },
  barValue: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 14,
    color: colors.inkSoft,
  },
  barLabel: {
    ...typography.label,
    fontSize: 10,
    lineHeight: 14,
    color: colors.inkFaint,
  },
});
