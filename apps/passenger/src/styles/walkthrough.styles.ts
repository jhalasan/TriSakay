import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  skip: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.lg,
    zIndex: 10,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  skipLabel: {
    ...typography.bodyStrong,
    color: colors.white,
  },
  slide: {
    flex: 1,
  },
  hero: {
    flex: 0.56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  motif: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -150,
    marginLeft: -150,
  },
  iconBadge: {
    width: 116,
    height: 116,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Verified-driver slide only — green is reserved for positive/verified status (DESIGN.md), so this is the one badge on the whole flow that earns it. */
  iconBadgeVerified: {
    backgroundColor: colors.accentGreenSoft,
    borderColor: colors.accentGreenSoft,
  },
  body: {
    flex: 0.44,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    alignItems: 'center',
  },
  title: {
    ...typography.h1,
    color: colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 320,
  },
  chrome: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  dot: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.line,
  },
});
