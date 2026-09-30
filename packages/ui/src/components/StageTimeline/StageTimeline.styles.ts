import { StyleSheet } from 'react-native';
import { colors, fontFamily, spacing } from '../../theme';

export const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  markerCol: {
    width: 22,
    alignItems: 'center',
  },
  markerDone: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accentGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerPending: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.panel,
    borderWidth: 2,
    borderColor: colors.line,
  },
  markerCurrentHalo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -4,
  },
  markerCurrent: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.panel,
    borderWidth: 2,
    borderColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerCurrentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentBlue,
  },
  connector: {
    width: 2,
    flex: 1,
    minHeight: 20,
    marginVertical: 3,
  },
  connectorCompact: {
    minHeight: 14,
  },
  textCol: {
    flex: 1,
    paddingBottom: 14,
  },
  textColCompact: {
    paddingBottom: 12,
  },
  textColLast: {
    paddingBottom: 0,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
  titlePending: {
    color: colors.inkFaint,
  },
  date: {
    fontSize: 12,
    lineHeight: 22,
    fontFamily: fontFamily.regular,
    color: colors.inkFaint,
    flexShrink: 0,
  },
  body: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fontFamily.regular,
    color: colors.inkSoft,
    marginTop: 2,
  },
});
