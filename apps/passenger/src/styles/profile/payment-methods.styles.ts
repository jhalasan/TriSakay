import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  card: {
    ...elevation.card,
  },
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.fill,
    borderRadius: radius.sm2,
    padding: spacing.md,
    marginTop: spacing.sm,
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
