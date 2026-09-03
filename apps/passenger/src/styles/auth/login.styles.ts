import { StyleSheet } from 'react-native';
import { colors, fontFamily, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  /** Fixed top band, outside the scroller — the badge below overlaps its bottom edge. */
  heroBand: {
    height: 186,
    borderBottomLeftRadius: radius.heroBottom,
    borderBottomRightRadius: radius.heroBottom,
  },
  motif: {
    position: 'absolute',
    top: -40,
    right: -46,
  },
  /** Pulled up over the hero/body boundary so the mark reads as a floating badge, rendered after (below) the band so it paints above it. */
  badgeWrap: {
    alignItems: 'center',
    marginTop: -44,
    marginBottom: spacing.lg,
  },
  markBadge: {
    width: 88,
    height: 88,
    borderRadius: 26, // literal — no matching radius token, see PHASE0_NOTES.md
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 26,
    elevation: 6,
  },
  mark: {
    width: 54,
    height: 63,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  title: {
    ...typography.h1,
    color: colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.caption,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  methodTrack: {
    marginBottom: spacing.lg,
  },
  fields: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  mobilePrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.tight10,
    marginRight: spacing.tight10,
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
  mobilePrefixText: {
    ...typography.bodyLg,
    color: colors.inkSoft,
  },
  mobileNotice: {
    ...typography.caption,
    color: colors.inkFaint,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  forgotLinkText: {
    ...typography.chip,
    color: colors.accentBlue,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.line,
  },
  dividerText: {
    ...typography.label,
    // Spec calls this `inkFaint`, but inkFaint only clears 4.5:1 on `panel`,
    // not on this screen's `bg` — same fix already applied to home.styles.ts;
    // keeping inkSoft here preserves that contrast floor.
    color: colors.inkSoft,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm2,
    padding: spacing.md,
  },
  errorBannerIcon: {
    marginTop: 1,
  },
  errorBannerText: {
    ...typography.caption,
    fontFamily: fontFamily.semibold,
    color: colors.dangerPressed,
    flex: 1,
  },
});
