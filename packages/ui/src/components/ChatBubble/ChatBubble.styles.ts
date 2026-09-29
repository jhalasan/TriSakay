import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: spacing.sm },
  rowSent: { justifyContent: 'flex-end' },
  rowReceived: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: radius.card, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, gap: 4 },
  bubbleSent: { backgroundColor: colors.accentBlue, borderBottomRightRadius: 4 },
  bubbleReceived: { backgroundColor: colors.panel, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.lineSoft },
  bodyText: { ...typography.body, fontSize: 15, lineHeight: 21 },
  bodyTextSent: { color: colors.white },
  bodyTextReceived: { color: colors.ink },
  quickReplyText: { ...typography.bodyStrong, fontSize: 15 },
  maskedNotice: { ...typography.caption, fontSize: 11, fontStyle: 'italic' },
  maskedNoticeSent: { color: 'rgba(255,255,255,0.7)' },
  maskedNoticeReceived: { color: colors.inkFaint },
  image: { width: 200, height: 200, borderRadius: radius.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  timeText: { fontSize: 10.5, lineHeight: 13 },
  timeTextSent: { color: 'rgba(255,255,255,0.65)' },
  timeTextReceived: { color: colors.inkFaint },
});
