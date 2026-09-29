import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  flex1: { flex: 1, backgroundColor: colors.bg },
  listContent: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 8, flexGrow: 1, justifyContent: 'flex-end' },

  privacyTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accentBlueSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  privacyTipText: { ...typography.body, fontSize: 11.5, lineHeight: 16, color: colors.accentBluePressed, flex: 1 },

  daySeparatorRow: { flexDirection: 'row', justifyContent: 'center' },
  daySeparator: {
    ...typography.label,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.6,
    color: colors.inkFaint,
    paddingTop: 4,
    paddingBottom: 6,
  },

  bubbleRow: { flexDirection: 'row' },
  bubbleRowReceived: { justifyContent: 'flex-start' },
  typingBubble: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },

  timestampRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 2, paddingHorizontal: 4, paddingBottom: 8 },
  timestampRowSent: { alignSelf: 'flex-end' },
  timestampRowReceived: { alignSelf: 'flex-start' },
  timestampText: { fontSize: 11, lineHeight: 15, color: colors.inkFaint },
  seenText: { ...typography.bodyStrong, fontSize: 11, lineHeight: 15, color: colors.accentGreenPressed },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: spacing.sm },
  emptyIconTile: { width: 56, height: 56, borderRadius: radius.md3, backgroundColor: colors.accentBlueSoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { ...typography.h3, fontSize: 18, lineHeight: 24, color: colors.ink },
  emptyBody: { ...typography.body, fontSize: 13.5, lineHeight: 20, color: colors.inkSoft, textAlign: 'center' },
  emptyNoteRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  emptyNoteText: { ...typography.body, fontSize: 12, lineHeight: 16, color: colors.inkSoft },

  skeletonRow: { flexDirection: 'row', marginBottom: spacing.sm },
  skeletonRowSent: { justifyContent: 'flex-end' },
  skeletonBubble: { height: 44, borderRadius: 18, backgroundColor: colors.fill },

  toast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: colors.ink,
    borderRadius: radius.md3,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  toastText: { ...typography.body, fontSize: 13, color: colors.white },

  viewerBackdrop: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  viewerClose: { position: 'absolute', right: 16, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '80%' },
});
