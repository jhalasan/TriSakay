import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  /**
   * Deeper `sheet` shadow (not `card`) — this panel anchors the whole page, so it should read as sitting highest.
   * No padding here: GradientSurface paints its gradient via an absolutely-filled SVG, and RN resolves that
   * fill's 0-offsets against the *padding* edge, not the outer edge — padding on this element would leave an
   * unpainted strip around the card showing the page background through instead of the gradient. Padding lives
   * on `heroPanelInner` instead, which sits fully inside the gradient's paint area.
   */
  heroPanel: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.lg,
    ...elevation.sheet,
  },
  heroPanelInner: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  heroMotifTop: {
    position: 'absolute',
    top: -50,
    right: -50,
  },
  heroMotifBottom: {
    position: 'absolute',
    bottom: -20,
    left: -30,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heroIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  /** Two nested rings (translucent outer, brand-green hairline inner) so the avatar lifts off the gradient instead of sitting flush with it. */
  avatarOuterRing: {
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.22)',
    ...elevation.card,
  },
  avatarInnerRing: {
    padding: 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.accentGreenSoft,
  },
  heroTextSlot: {
    flex: 1,
    gap: 2,
  },
  heroGreetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroGreetingLabel: {
    ...typography.label,
    color: colors.white,
    opacity: 0.75,
  },
  heroName: {
    ...typography.h1,
    color: colors.white,
  },
  heroTagline: {
    ...typography.caption,
    color: colors.white,
    opacity: 0.75,
    marginTop: spacing.xs,
  },
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
    borderColor: colors.panel,
  },
  /** Own pressed-state wrapper (rather than Button) since this is a full custom gradient card, not a text button. Negative top margin pulls it up under the hero's rounded bottom edge so the two panels read as one composed unit. */
  ctaWrap: {
    borderRadius: radius.lg,
    marginTop: -spacing.md,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  /** No padding here — see the comment on `heroPanel`; padding lives on `ctaCardInner` instead. */
  ctaCard: {
    borderRadius: radius.lg,
    ...elevation.card,
  },
  ctaCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  ctaMotif: {
    position: 'absolute',
    top: -30,
    right: -30,
  },
  ctaIconBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTextSlot: {
    flex: 1,
    gap: 2,
  },
  ctaTitle: {
    ...typography.h2,
    color: colors.white,
  },
  ctaSubtitle: {
    ...typography.caption,
    color: colors.white,
    opacity: 0.85,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.inkSoft,
    marginBottom: spacing.md,
  },
  shortcuts: {
    gap: spacing.md,
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.fill,
    minHeight: 68,
  },
  shortcutIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutTextSlot: {
    flex: 1,
    gap: 2,
  },
  shortcutLabel: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  shortcutAddress: {
    ...typography.caption,
    color: colors.inkSoft,
  },
});
