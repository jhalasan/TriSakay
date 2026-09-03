import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  // #14191D is `colors.ink` itself — the strip's own dark ground, not a new hex.
  safeArea: {
    backgroundColor: colors.ink,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 1,
    paddingHorizontal: spacing.tight18,
    paddingBottom: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F2B8B5', // literal — no matching token, see docs/design_handoff_trisakay_passenger/PHASE0_NOTES.md
  },
  text: {
    ...typography.bodyStrong,
    fontSize: 12,
    color: colors.white,
  },
});
