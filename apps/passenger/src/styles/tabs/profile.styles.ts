import { StyleSheet } from 'react-native';
import { colors, elevation, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  /** Rounded rather than edge-to-edge — the scroller already carries a
   * horizontal inset every other card on this screen shares, so the hero
   * reads as one more card in the same rhythm instead of breaking out of it. */
  heroBand: {
    height: 132,
    borderRadius: 24,
    marginTop: spacing.md,
  },
  motif: {
    position: 'absolute',
    top: -50,
    right: -50,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  heroLabel: {
    ...typography.label,
    color: colors.white,
    opacity: 0.85,
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Pulled up over the hero/body seam so the avatar reads as floating. */
  identity: {
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: -48,
  },
  /** Non-clipping wrapper — the edit badge sits just outside the ring's own bounds. */
  avatarWrap: {
    position: 'relative',
  },
  avatarRing: {
    padding: 4,
    borderRadius: 999,
    backgroundColor: colors.white,
    ...elevation.card,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentBlue,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    ...typography.h2,
    color: colors.ink,
    marginTop: spacing.sm,
  },
  editFieldWrap: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },
  detailsCard: {
    flexDirection: 'row',
  },
  detailCol: {
    flex: 1,
    gap: 2,
  },
  detailLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailLabel: {
    ...typography.label,
    color: colors.inkSoft,
  },
  detailValue: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  navGroup: {
    gap: spacing.xs,
  },
});
