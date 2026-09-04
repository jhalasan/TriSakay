import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  // The mock shows this over a flat map-ground backdrop, not a dark scrim —
  // `colors.overlay` is reserved for true blocking dialogs over an active
  // screen (log out); this gate is closer to the booking flow's "map behind
  // a docked sheet" language, just without a live map since location isn't
  // granted yet.
  backdrop: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.panel,
    borderRadius: 26, // literal — no matching radius token, see docs/design_handoff_trisakay_passenger/PHASE0_NOTES.md
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
    ...elevation.sheet,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.md3,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h2,
    color: colors.ink,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  blockedNote: {
    ...typography.caption,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
