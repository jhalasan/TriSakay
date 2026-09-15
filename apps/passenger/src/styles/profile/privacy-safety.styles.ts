import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },

  // Shadow lives on this outer wrapper, never on the same view as
  // overflow:'hidden' + borderRadius (see home.styles.ts's heroShadowWrap).
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
    borderRadius: radius.lg,
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
  heroEyebrow: {
    ...typography.eyebrow,
    color: colors.white,
    opacity: 0.75,
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

  sosGroup: {
    gap: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusRowSending: {
    backgroundColor: colors.fill,
  },
  statusRowSent: {
    backgroundColor: colors.accentGreenSoft,
  },
  statusRowFailed: {
    backgroundColor: colors.dangerSoft,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  statusText: {
    ...typography.caption,
    color: colors.inkSoft,
    flex: 1,
  },
  statusTextFailed: {
    ...typography.caption,
    color: colors.danger,
  },
  retryLink: {
    ...typography.bodyStrong,
    fontSize: 13,
    color: colors.accentBlue,
  },

  card: {
    ...elevation.card,
    gap: spacing.sm,
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

  sectionLabel: {
    ...typography.label,
    color: colors.inkSoft,
    marginBottom: spacing.xs,
  },
  navGroup: {
    padding: 0,
  },
  navIconTile: {
    width: 34,
    height: 34,
    borderRadius: radius.sm2,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  noticeBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.fill,
    borderRadius: radius.sm2,
    padding: spacing.md,
  },
  noticeIcon: {
    marginTop: 1,
  },
  noticeText: {
    ...typography.caption,
    color: colors.inkSoft,
    flex: 1,
  },
  noticeTextSlot: {
    flex: 1,
    gap: 2,
  },
});
