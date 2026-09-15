import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

// P1-24 (2026-09-15 launch audit): mirrors apps/passenger's OfflineStrip.styles.ts verbatim.
export const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.ink,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 1,
    paddingHorizontal: spacing.tight18,
    paddingBottom: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F2B8B5',
  },
  text: {
    ...typography.bodyStrong,
    fontSize: 12,
    color: colors.white,
  },
});
