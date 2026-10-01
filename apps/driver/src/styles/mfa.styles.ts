import { StyleSheet } from 'react-native';
import { colors, fontFamily, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { paddingTop: 6, paddingHorizontal: 16, paddingBottom: 24, gap: 14 },
  infoCard: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.accentBlueSoft, borderRadius: radius.md3, padding: 14 },
  infoTile: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  infoText: { flex: 1, fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, color: colors.ink },
  secretBox: { backgroundColor: colors.white, borderRadius: radius.md3, padding: 14, gap: 4, borderWidth: 1, borderColor: colors.lineSoft },
  secretLabel: { ...typography.label, fontSize: 10, color: colors.inkFaint },
  secretValue: { ...typography.bodyStrong, fontSize: 15, letterSpacing: 1.5, color: colors.ink },
  errorText: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.danger },
  bottomBar: {
    paddingTop: 12,
    paddingHorizontal: 16,
    gap: 8,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    paddingBottom: spacing.lg,
  },
  challengeContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24, gap: 14 },
  challengeTile: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.accentBlueSoft, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  challengeTitle: { ...typography.h2, color: colors.ink, textAlign: 'center' },
  challengeBody: { ...typography.body, color: colors.inkSoft, textAlign: 'center' },
});
