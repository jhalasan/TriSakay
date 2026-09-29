import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: 2 },
  rowSent: { justifyContent: 'flex-end' },
  rowReceived: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  bubbleImage: { padding: 0, overflow: 'hidden' },
  // Split in two on purpose: the shadow lives on `liftedWrap` (the outer,
  // non-clipping View) while the scale transform stays on the bubble
  // itself — see the comment at the call site.
  liftedWrap: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
  bubbleLiftedScale: {
    transform: [{ scale: 1.03 }],
  },
  bubbleSent: { backgroundColor: colors.accentBlue },
  bubbleReceived: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineSoft },
  bubbleSentQuickReply: { backgroundColor: colors.accentBlue },
  bubbleReceivedQuickReply: { backgroundColor: colors.accentBlueSoft },
  bodyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  segmentedWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  bodyText: { ...typography.body, fontSize: 15, lineHeight: 21 },
  bodyTextFlex: { flexShrink: 1 },
  bodyTextSent: { color: colors.white },
  bodyTextReceived: { color: colors.ink },
  quickReplyText: { ...typography.bodyStrong, fontSize: 15, lineHeight: 21, color: colors.white },
  quickReplyTextReceived: { color: colors.accentBluePressed },
  maskedToken: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  maskedTokenReceived: { backgroundColor: colors.bg, borderColor: colors.lineStrong },
  maskedTokenSent: { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.5)' },
  maskedTokenText: { ...typography.body, fontSize: 13, lineHeight: 19 },
  maskedTokenTextReceived: { color: colors.inkSoft },
  maskedTokenTextSent: { color: colors.white },
  image: { width: 210, height: 180 },
  imagePlaceholder: {
    width: 210,
    height: 180,
    backgroundColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
