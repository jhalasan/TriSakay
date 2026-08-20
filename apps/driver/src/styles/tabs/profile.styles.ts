import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.lg, gap: spacing.lg },
  /** Rounded rather than edge-to-edge — the scroller already carries a
   * horizontal inset every other card on this screen shares, so the hero
   * reads as one more card in the same rhythm instead of breaking out of it. */
  heroBand: {
    height: 132,
    borderRadius: 24,
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
  identity: { alignItems: 'center', gap: spacing.xs, marginTop: -48 },
  /** Non-clipping wrapper — the edit badge sits just outside the ring's own bounds. */
  avatarWrap: { position: 'relative' },
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
  editFieldWrap: { width: '100%', marginTop: spacing.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  name: { ...typography.h2, color: colors.ink },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.accentGreenSoft,
  },
  verifiedBadgeText: {
    ...typography.caption,
    fontFamily: typography.label.fontFamily,
    fontSize: 11,
    color: colors.accentGreen,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  ratingPillText: {
    ...typography.caption,
    color: colors.inkSoft,
  },
  detailsCard: { gap: spacing.md },
  /** Stacked full-width rather than side-by-side columns — a bordered
   * TextField (52px, min-height) sitting next to plain label text in a
   * cramped half-width column read as overlapping/awkward in edit mode. */
  detailRow: { gap: spacing.xs },
  detailDivider: { height: 1, backgroundColor: colors.lineSoft },
  detailLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  detailLabel: { ...typography.label, color: colors.inkSoft },
  detailValue: { ...typography.bodyStrong, color: colors.ink },
  navGroup: { gap: spacing.xs },
});
