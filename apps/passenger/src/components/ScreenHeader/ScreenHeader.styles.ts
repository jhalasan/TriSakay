import { StyleSheet } from 'react-native';
import { colors, elevation, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 13, // literal — no matching radius token, see docs/design_handoff_trisakay_passenger/PHASE0_NOTES.md
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
    ...elevation.card,
  },
  titleCompact: {
    ...typography.h3b,
    color: colors.ink,
    flex: 1,
  },
  titleLarge: {
    ...typography.h1b,
    color: colors.ink,
    flex: 1,
  },
  rightSlot: {
    alignItems: 'flex-end',
  },
});
