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
    maxWidth: 360,
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
  options: {
    gap: spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  optionSelected: {
    borderColor: colors.accentBlue,
    backgroundColor: colors.accentBlueSoft,
  },
  optionLabel: {
    ...typography.body,
    color: colors.ink,
    flex: 1,
  },
  optionLabelSelected: {
    color: colors.accentBlue,
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
