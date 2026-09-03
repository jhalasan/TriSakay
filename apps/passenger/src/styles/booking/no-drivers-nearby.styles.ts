import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.fill,
  },
  mapFill: {
    ...StyleSheet.absoluteFillObject,
  },
  topFloating: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
  },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: 15, // literal — no matching radius token, see docs/design_handoff_trisakay_passenger/PHASE0_NOTES.md
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fill,
  },
  title: {
    ...typography.h2,
    color: colors.ink,
  },
  cause: {
    ...typography.body,
    color: colors.inkSoft,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.card,
    padding: spacing.md,
    marginTop: 2,
  },
  toggleLabel: {
    ...typography.bodyStrong,
    color: colors.ink,
    flex: 1,
  },
  primaryButton: {
    marginTop: spacing.xs,
  },
});
