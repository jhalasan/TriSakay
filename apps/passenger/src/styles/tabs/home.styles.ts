import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingBottom: spacing.tight44 * 1.7, gap: spacing.lg },

  // Shadow lives on this outer wrapper, never on the same view as
  // overflow:'hidden' + borderRadius — combining them on Android makes the
  // elevation shadow render as an unclipped rectangle that bleeds past the
  // rounded corners and shows a ghosted duplicate of the clipped content.
  // No backgroundColor here on purpose: this wrapper only spans the hero's
  // asymmetric bottom-only radius, and a flat fill color shows through as a
  // visible seam against the gradient rather than blending with it.
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
  },
  heroMotifTop: { position: 'absolute', top: -46, right: -52 },
  heroRow: { paddingHorizontal: spacing.tight18, paddingTop: spacing.lg, paddingBottom: spacing.tight22, gap: spacing.tight14 },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  heroIdentityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  avatarOuterRing: { padding: 3, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.22)' },
  avatarInnerRing: { padding: 2, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.accentGreenSoft },
  heroTextSlot: { flex: 1, gap: 5 },
  heroGreetingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  heroGreetingLabel: { ...typography.eyebrow, color: colors.white, opacity: 0.75, letterSpacing: 0.9 },
  heroName: { ...typography.h1b, color: colors.white, letterSpacing: -0.4 },
  heroTagline: { ...typography.caption, color: colors.white, opacity: 0.68, marginTop: 1 },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  bellDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.accentBlueDeep,
  },

  statsStrip: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: spacing.tight18,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  statsDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.14)', marginHorizontal: spacing.md },

  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },

  // Shadow lives on this outer wrapper, never on the GradientSurface's own
  // style — GradientSurface always sets overflow:'hidden' on its container,
  // and combining that with borderRadius + an elevation shadow on Android
  // makes the shadow render as an unclipped rectangle bleeding past the
  // rounded corners.
  ctaCardShadowWrap: { borderRadius: radius.lg2, backgroundColor: colors.accentGreen, ...elevation.card },
  ctaCard: { borderRadius: radius.lg2 },
  ctaMotif: { position: 'absolute', top: -34, right: -30 },
  ctaCardInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.tight18 },
  ctaIconBadge: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trikeMark: { width: 30, height: 30 },
  ctaTextSlot: { flex: 1, gap: 4 },
  ctaTitle: { ...typography.h2b, color: colors.white },
  ctaChipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  ctaChip: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  ctaChipText: { ...typography.chip, color: colors.white },
  ctaNearbyText: { ...typography.chip, color: colors.white, opacity: 0.8 },
  ctaSubtitle: { ...typography.caption, color: colors.white, opacity: 0.85 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sectionLabel: { ...typography.eyebrow, color: colors.inkSoft },
  manageLink: { ...typography.chip, color: colors.accentBlue },

  shortcuts: { gap: spacing.tight10 },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight14,
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.tight14,
    backgroundColor: colors.white,
    minHeight: 70,
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  shortcutIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  shortcutTextSlot: { flex: 1, gap: 2 },
  shortcutLabel: { ...typography.bodyStrong, color: colors.ink },
  shortcutAddress: { ...typography.caption, color: colors.inkSoft },

  emptyPanel: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius.md3,
    padding: spacing.tight34,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  emptyMotif: { position: 'absolute', top: -20, right: -20 },
  emptyIconTile: {
    width: 46,
    height: 46,
    borderRadius: radius.sm2,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { ...typography.h3, color: colors.ink, textAlign: 'center' },
  emptyMessage: { ...typography.caption, color: colors.inkSoft, textAlign: 'center', marginTop: spacing.xs },

  offlineWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  offlineIconTile: {
    width: 46,
    height: 46,
    borderRadius: radius.sm2,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  offlineTitle: { ...typography.h2, color: colors.ink, textAlign: 'center' },
  offlineMessage: {
    ...typography.body,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 280,
  },
  offlineButton: { alignSelf: 'stretch', marginTop: spacing.lg },
  offlineReceiptLink: {
    ...typography.bodyStrong,
    fontSize: 13,
    color: colors.accentBlue,
    marginTop: spacing.sm,
  },
});
