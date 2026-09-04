import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },

  // Shadow lives on this outer wrapper, never on the same view as
  // overflow:'hidden' + borderRadius (see home.styles.ts's heroShadowWrap).
  heroShadowWrap: {
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 10,
  },
  heroPanel: {
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: radius.heroBottom,
    borderBottomRightRadius: radius.heroBottom,
    paddingHorizontal: spacing.tight18,
    paddingTop: spacing.sm,
    paddingBottom: spacing.tight44 + spacing.tight10,
  },
  motif: {
    position: 'absolute',
    top: -46,
    right: -52,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroEyebrow: {
    ...typography.eyebrow,
    color: colors.white,
    opacity: 0.66,
  },
  heroTitle: {
    ...typography.h1b,
    fontSize: 26,
    color: colors.white,
    marginTop: 2,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  editButtonLabel: {
    ...typography.bodyStrong,
    fontSize: 13,
    color: colors.white,
  },

  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  /** Pulled up over the hero/body seam so the avatar reads as floating. */
  identity: {
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: -44,
  },
  /** Non-clipping wrapper — the edit badge sits just outside the ring's own bounds. */
  avatarWrap: {
    position: 'relative',
  },
  avatarRing: {
    padding: 4,
    borderRadius: 999,
    backgroundColor: colors.bg,
  },
  avatarInnerRing: {
    padding: 2,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.accentGreenSoft,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accentGreen,
    borderWidth: 2.5,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    ...typography.h2,
    color: colors.ink,
    marginTop: spacing.sm,
  },
  ridesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  ridesText: {
    ...typography.caption,
    color: colors.inkSoft,
  },
  editFieldWrap: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },

  // Discount status banner — green when an approved discount is active
  // (mirrors the emergency/hero band's texture-free solid-fill treatment),
  // neutral navy-tinted invite when the passenger has none yet. Shadow lives
  // on the wrap below, never on the same view as overflow:'hidden' +
  // borderRadius (see home.styles.ts's heroShadowWrap).
  discountBannerShadowWrap: {
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  discountBanner: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  discountBannerNeutral: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  discountBannerMotif: {
    position: 'absolute',
    top: -20,
    right: -20,
  },
  discountIconTile: {
    width: 44,
    height: 44,
    borderRadius: radius.sm2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountIconTileActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  discountIconTileNeutral: {
    backgroundColor: colors.accentBlueSoft,
  },
  discountTextSlot: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  discountTitle: {
    ...typography.bodyStrong,
    fontSize: 16,
    color: colors.white,
  },
  discountTitleNeutral: {
    color: colors.ink,
  },
  discountSubtitle: {
    ...typography.caption,
    color: colors.white,
    opacity: 0.82,
  },
  discountSubtitleNeutral: {
    color: colors.inkSoft,
  },

  detailsCard: {
    gap: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  detailIconTile: {
    width: 34,
    height: 34,
    borderRadius: radius.xs,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTextSlot: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.lineSoft,
  },
  detailLabel: {
    ...typography.label,
    fontSize: 10,
    color: colors.inkFaint,
  },
  detailValue: {
    ...typography.bodyStrong,
    fontSize: 14,
    color: colors.ink,
  },
  detailEditWrap: {
    flex: 1,
  },

  sectionLabel: {
    ...typography.label,
    color: colors.inkSoft,
    marginBottom: spacing.sm,
  },
  navGroup: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 2,
  },
  navIconTile: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
