import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  band: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    borderBottomLeftRadius: radius.heroBottom,
    borderBottomRightRadius: radius.heroBottom,
  },
  motif: {
    position: 'absolute',
    top: -40,
    right: -46,
  },
  pulseWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  pulseRing: {
    position: 'absolute',
  },
  alertCore: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h1b,
    color: colors.white,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.white,
    opacity: 0.86,
    textAlign: 'center',
  },
  content: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  statusRowSending: {
    backgroundColor: colors.fill,
  },
  statusRowSent: {
    backgroundColor: colors.accentGreenSoft,
  },
  statusRowFailed: {
    backgroundColor: colors.dangerSoft,
  },
  statusIconTile: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.accentGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    ...typography.bodyStrong,
    color: colors.ink,
    flex: 1,
  },
  statusTextFailed: {
    ...typography.body,
    color: colors.danger,
    flex: 1,
  },
  retryLink: {
    ...typography.bodyStrong,
    color: colors.accentBlue,
  },
  sharedPanel: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sharedLabel: {
    ...typography.label,
    color: colors.inkSoft,
    marginBottom: spacing.xs,
  },
  sharedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sharedRowText: {
    ...typography.body,
    color: colors.inkSoft,
    flex: 1,
  },
  backLink: {
    ...typography.bodyStrong,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
