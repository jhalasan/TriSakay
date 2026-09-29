import { StyleSheet } from 'react-native';
import { colors, fontFamily, radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.sheetTop,
    borderTopRightRadius: radius.sheetTop,
    paddingTop: 10,
    paddingHorizontal: 18,
    gap: spacing.md,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: spacing.xs },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconTile: { width: 44, height: 44, borderRadius: radius.sm2, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: 2 },
  title: { fontFamily: fontFamily.extrabold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3, color: colors.ink },
  from: { ...typography.body, fontSize: 12.5, lineHeight: 17, color: colors.inkSoft },
  body: { ...typography.body, fontSize: 14, lineHeight: 21, color: colors.inkSoft },
  buttons: { gap: spacing.sm },
  reportButton: { minHeight: 54, borderRadius: radius.md3, borderWidth: 1.5, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  reportText: { ...typography.bodyStrong, fontSize: 15.5, color: colors.danger },
  cancelButton: { minHeight: 54, borderRadius: radius.md3, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' },
  cancelText: { ...typography.bodyStrong, fontSize: 15.5, color: colors.ink },
});
