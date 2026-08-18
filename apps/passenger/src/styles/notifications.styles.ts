import { StyleSheet } from 'react-native';
import { colors, fontFamily, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  markReadText: {
    ...typography.caption,
    color: colors.accentBlue,
    fontFamily: fontFamily.semibold,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  dotSlot: {
    width: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentBlue,
  },
  textSlot: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  body: {
    ...typography.body,
    color: colors.inkSoft,
  },
  date: {
    ...typography.caption,
    color: colors.inkSoft, // rows sit on bg, not panel
  },
});
