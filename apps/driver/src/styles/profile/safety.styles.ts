import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },

  // Shadow lives on this outer wrapper, never on the same view as
  // overflow:'hidden' + borderRadius.
  heroShadowWrap: {
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 26,
    elevation: 8,
  },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.md3,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  heroMotif: {
    position: 'absolute',
    top: -34,
    right: -30,
  },
  heroIconTile: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  heroTitle: {
    ...typography.h2,
    color: colors.white,
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.white,
    opacity: 0.85,
  },

  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.md3,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardIconTile: {
    width: 32,
    height: 32,
    borderRadius: radius.sm2,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  cardBody: {
    ...typography.body,
    color: colors.inkSoft,
  },

  tipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tipBullet: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.accentBlue,
    marginTop: 7,
  },
  tipText: {
    ...typography.body,
    color: colors.inkSoft,
    flex: 1,
  },

  linkRow: {
    marginTop: spacing.xs,
  },
  link: {
    ...typography.bodyStrong,
    color: colors.accentBlue,
  },
});
