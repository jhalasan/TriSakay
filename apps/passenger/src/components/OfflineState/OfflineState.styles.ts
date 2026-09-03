import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: 15, // literal — no matching radius token, see docs/design_handoff_trisakay_passenger/PHASE0_NOTES.md
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.h2, color: colors.ink, textAlign: 'center', marginTop: spacing.md },
  message: {
    ...typography.body,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 280,
  },
  button: { alignSelf: 'stretch', marginTop: spacing.lg },
  receiptLink: {
    ...typography.bodyStrong,
    fontSize: 13,
    color: colors.accentBlue,
    marginTop: spacing.sm,
  },
});
