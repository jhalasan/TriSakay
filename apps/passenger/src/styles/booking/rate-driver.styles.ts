import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
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
});
