import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  // --- compact variant (unchanged from the pre-redesign component) ---
  card: { gap: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  route: { flex: 1, ...typography.bodyStrong, color: colors.ink },
  actions: { flexDirection: 'row', gap: spacing.md },
  actionButton: { flex: 1 },

  // --- incoming variant ---
  incomingCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    padding: 0,
    ...elevation.floatingCard,
  },
  headerBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accentGreenSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.tight14,
  },
  headerBandLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headerBandLabel: { ...typography.eyebrow, color: colors.accentGreenPressed },
  headerBandRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  // D7 (UAT audit) — same chip styling as the driver app's own Dashboard
  // countdown (apps/driver/src/styles/tabs/dashboard.styles.ts), reused here
  // so the Requests board shows the same time-limit signal per card.
  countdownChip: { backgroundColor: colors.dangerSoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  countdownChipText: { ...typography.bodySm, fontSize: 11, lineHeight: 16, color: colors.danger },
  fare: { fontSize: 22, lineHeight: 26, fontFamily: 'Poppins_800ExtraBold', letterSpacing: -0.6, color: colors.accentGreenPressed },
  body: { flexDirection: 'row', padding: spacing.lg, gap: spacing.tight14 },
  timelineRail: { alignItems: 'center', width: 12, paddingTop: 4 },
  timelineDotOuter: { width: 9, height: 9, borderRadius: 4.5, borderWidth: 2, borderColor: colors.accentBlue },
  timelineConnector: { flex: 1, width: 2, backgroundColor: colors.line, marginVertical: 4 },
  timelineDotDest: { width: 9, height: 9, backgroundColor: colors.accentGreen },
  stops: { flex: 1, gap: spacing.md },
  stop: { gap: 2 },
  stopLabel: { fontSize: 11, lineHeight: 15, fontFamily: 'Poppins_400Regular', textTransform: 'uppercase', color: colors.inkFaint },
  stopValue: { ...typography.bodyLg, color: colors.ink },
  incomingActions: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, paddingTop: 0 },
  declineButton: { width: 96, minHeight: 48, justifyContent: 'center' },
  acceptButton: { flex: 1, minHeight: 48, justifyContent: 'center' },
});
