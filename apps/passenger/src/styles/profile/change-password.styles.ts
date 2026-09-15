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
  fields: {
    gap: spacing.md,
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
});
