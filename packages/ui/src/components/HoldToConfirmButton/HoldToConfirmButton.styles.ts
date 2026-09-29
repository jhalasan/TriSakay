import { StyleSheet } from 'react-native';
import { colors, fontFamily, radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  // --- fab variant (README §6.2 — active-trip screen's floating SOS) ---
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
  fabRing: { position: 'absolute', top: -3, left: -3 },
  fabContent: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  fabLabel: { fontSize: 11, lineHeight: 13, letterSpacing: 0.6, fontFamily: fontFamily.extrabold, color: colors.white },

  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors.danger,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    minHeight: 52,
    overflow: 'hidden',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.4,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconSlot: {
    marginRight: spacing.sm,
  },
  label: {
    ...typography.button,
    color: colors.white,
  },
});
