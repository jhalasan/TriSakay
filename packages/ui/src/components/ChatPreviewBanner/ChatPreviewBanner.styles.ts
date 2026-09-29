import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md3,
    padding: 12,
    paddingLeft: 14,
    shadowColor: colors.accentBlueDeep,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 10,
  },
  textColumn: { flex: 1, gap: 2 },
  title: { ...typography.bodyStrong, fontSize: 14, color: colors.ink },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  preview: { ...typography.body, fontSize: 13, lineHeight: 18, color: colors.inkSoft, flexShrink: 1 },
  replyButton: { minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radius.sm, backgroundColor: colors.accentBlueSoft, alignItems: 'center', justifyContent: 'center' },
  replyText: { ...typography.bodyStrong, fontSize: 13, color: colors.accentBlue },
});
