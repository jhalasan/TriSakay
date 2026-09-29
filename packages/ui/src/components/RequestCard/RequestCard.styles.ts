import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  // --- compact variant (unchanged from the pre-redesign component) ---
  card: { gap: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  route: { flex: 1, ...typography.bodyStrong, color: colors.ink },
  actions: { flexDirection: 'row', gap: spacing.md },
  actionButton: { flex: 1 },

  // --- incoming variant (driver redesign v2, README §3a) ---
  incomingCard: {
    borderRadius: radius.lg2,
    overflow: 'hidden',
    padding: 0,
    ...elevation.floatingCard,
  },
  // 4px linear countdown bar across the top of the card — replaces the old
  // green header band + inline chip (the chip now lives above the card,
  // in the caller's own section header, per the redesign).
  countdownTrack: { height: 4, backgroundColor: colors.fill, width: '100%' },
  countdownFill: { height: 4, backgroundColor: colors.danger },
  fare: { fontSize: 30, lineHeight: 34, fontFamily: 'Poppins_800ExtraBold', letterSpacing: -0.8, color: colors.ink },
  metaLine: { ...typography.bodySm, fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  body: { padding: spacing.lg, gap: spacing.tight14 },
  routeRow: { flexDirection: 'row', gap: spacing.tight14, marginTop: spacing.xs },
  timelineRail: { alignItems: 'center', width: 12, paddingTop: 4 },
  timelineDotOuter: { width: 9, height: 9, borderRadius: 4.5, borderWidth: 2, borderColor: colors.accentBlue },
  timelineConnector: { flex: 1, width: 2, backgroundColor: colors.line, marginVertical: 4 },
  timelineDotDest: { width: 9, height: 9, backgroundColor: colors.accentGreen },
  stops: { flex: 1, gap: spacing.md },
  stop: { gap: 2 },
  stopLabel: { fontSize: 11.5, lineHeight: 15, fontFamily: 'Poppins_400Regular', color: colors.inkFaint },
  stopValue: { ...typography.bodyLg, color: colors.ink },
  incomingActions: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, paddingTop: 0 },
  declineButton: { width: 104, justifyContent: 'center' },
  acceptButton: { flex: 1, justifyContent: 'center' },
});
