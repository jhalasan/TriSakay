import { StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';

export const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.panel,
    borderTopLeftRadius: 26, // literal — no matching radius token, see docs/design_handoff_trisakay_passenger/PHASE0_NOTES.md
    borderTopRightRadius: 26,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: -14 },
    shadowOpacity: 0.16,
    shadowRadius: 36,
    elevation: 12,
  },
  /** Plain neutral grip, not the brand gradient — a drag handle is chrome, not a branded surface. */
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    alignSelf: 'center',
  },
});
