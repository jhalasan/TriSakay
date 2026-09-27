import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '80%',
    backgroundColor: colors.panel,
    borderRadius: radius.xl2,
    padding: spacing.xl,
    gap: spacing.md,
    ...elevation.sheet,
  },
  title: {
    ...typography.h2,
    color: colors.ink,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  message: {
    ...typography.body,
    color: colors.inkSoft,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  list: {
    gap: spacing.xs,
  },
  candidate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  candidateSelected: {
    borderColor: colors.accentBlue,
    backgroundColor: colors.accentBlueSoft,
  },
  candidateInfo: {
    flex: 1,
  },
  candidateName: {
    ...typography.body,
    color: colors.ink,
  },
  candidateMeta: {
    ...typography.caption,
    color: colors.inkSoft,
  },
  empty: {
    ...typography.body,
    color: colors.inkSoft,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
});
