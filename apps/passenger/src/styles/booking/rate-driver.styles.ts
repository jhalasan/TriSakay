import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  band: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  bandMotif: {
    position: 'absolute',
    top: -30,
    right: -30,
  },
  bandEyebrow: {
    ...typography.eyebrow,
    color: colors.white,
    opacity: 0.75,
  },
  bandTitle: {
    ...typography.h1b,
    color: colors.white,
  },
  bandSummary: {
    ...typography.caption,
    color: colors.white,
    opacity: 0.85,
    marginTop: spacing.xs,
  },
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  /** Driver summary gets the same raised weight as the rest of the flow. */
  driverCard: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.lg,
  },
  name: {
    ...typography.h1,
    color: colors.ink,
    marginTop: spacing.lg,
  },
  subtitle: {
    ...typography.body,
    color: colors.inkSoft,
    marginTop: spacing.xs,
  },
  starsRow: {
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
  },
  commentWrap: {
    alignSelf: 'stretch',
  },
  submitWrap: {
    alignSelf: 'stretch',
    marginTop: spacing.xl,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  fallbackNote: {
    ...typography.body,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
});
