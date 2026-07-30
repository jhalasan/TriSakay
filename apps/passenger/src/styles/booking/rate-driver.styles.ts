import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

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
