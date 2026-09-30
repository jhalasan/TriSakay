import { StyleSheet } from 'react-native';
import { colors, fontFamily, radius } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { paddingTop: 6, paddingHorizontal: 16, paddingBottom: 24, gap: 14 },
  statusCard: { flexDirection: 'row', gap: 12, backgroundColor: colors.accentBlueSoft, borderRadius: radius.md3, padding: 14 },
  statusTile: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  statusBody: { flex: 1, gap: 2 },
  statusTitle: { fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 20, color: colors.ink },
  statusText: { fontFamily: fontFamily.regular, fontSize: 12.5, lineHeight: 18, color: colors.ink, opacity: 0.85 },
  bottomBar: {
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
});
