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
  beaconWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  eyebrowDots: {
    flexDirection: 'row',
    gap: 5,
  },
  eyebrowDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accentBlue,
  },
  eyebrowLabel: {
    ...typography.label,
    color: colors.inkSoft,
  },
  titleBlock: {
    gap: 4,
  },
  title: {
    ...typography.h1b,
    color: colors.ink,
  },
  subtitle: {
    ...typography.body,
    color: colors.inkSoft,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  infoIconTile: {
    width: 38,
    height: 38,
    borderRadius: 12, // literal — no matching radius token, see docs/design_handoff_trisakay_passenger/PHASE0_NOTES.md
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextSlot: {
    flex: 1,
    gap: 1,
  },
  infoTitle: {
    ...typography.bodySm,
    color: colors.ink,
  },
  infoSubtitle: {
    ...typography.caption,
    color: colors.inkSoft,
  },
  cancelButton: {
    alignSelf: 'stretch',
  },
  cancelError: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
