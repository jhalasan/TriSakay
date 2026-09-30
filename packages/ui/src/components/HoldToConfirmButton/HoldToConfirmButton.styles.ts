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

  // --- disc variant (Privacy & Safety SOS, trip-records handoff §2b) ---
  discOuter: {
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discPressed: { transform: [{ scale: 0.97 }] },
  discRing: { position: 'absolute', top: 0, left: 0 },
  // The shadow sits on this wrapper: the gradient inside clips to its rounded corners, which would drop a shadow set on it.
  discInnerShadow: {
    width: 116,
    height: 116,
    borderRadius: 58,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  },
  discInner: { width: 116, height: 116, borderRadius: 58, alignItems: 'center', justifyContent: 'center' },
  discContent: { alignItems: 'center', gap: 1 },
  discLabel: { fontSize: 26, lineHeight: 30, letterSpacing: 0.5, fontFamily: fontFamily.extrabold, color: colors.white },
  discSublabel: { fontSize: 11, lineHeight: 15, fontFamily: fontFamily.semibold, color: 'rgba(255, 255, 255, 0.9)' },

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
