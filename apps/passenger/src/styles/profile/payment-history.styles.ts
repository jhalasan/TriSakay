import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  trailingSlot: {
    alignItems: 'flex-end',
    gap: 4,
  },
  fareText: {
    ...typography.caption,
    color: colors.inkSoft,
  },
});
