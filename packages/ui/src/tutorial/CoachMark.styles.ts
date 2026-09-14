import { StyleSheet } from 'react-native';
import { colors, fontFamily } from '../theme';

const DIM = 'rgba(2, 16, 32, 0.66)';

export const styles = StyleSheet.create({
  coachMarkFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
  },
  dimBox: {
    position: 'absolute',
    backgroundColor: DIM,
  },
  dimTop: {
    top: 0,
    left: 0,
    right: 0,
  },
  dimBottom: {
    left: 0,
    right: 0,
    bottom: 0,
  },
  dimLeft: {
    left: 0,
  },
  dimRight: {
    right: 0,
  },
  spotlightRect: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.55)',
  },
  tooltip: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 18,
    shadowColor: colors.accentBlueDeep,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.34,
    shadowRadius: 34,
    elevation: 12,
  },
  tooltipArrow: {
    position: 'absolute',
    width: 16,
    height: 16,
    backgroundColor: colors.white,
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
  tooltipHeaderRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  tooltipChip: {
    backgroundColor: colors.accentBlueSoft,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  tooltipChipText: {
    fontFamily: fontFamily.extrabold,
    fontSize: 11,
    lineHeight: 16,
    color: colors.accentBlue,
  },
  tooltipTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 17,
    lineHeight: 22,
    color: colors.ink,
    marginBottom: 6,
  },
  tooltipBody: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.inkSoft,
    marginBottom: 14,
  },
  tooltipTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.lineSoft,
    overflow: 'hidden',
    marginBottom: 14,
  },
  tooltipTrackFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accentBlue,
  },
  tooltipControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  tooltipSkip: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.inkFaint,
  },
  tooltipBack: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.inkFaint,
  },
  tooltipBackHidden: {
    opacity: 0,
  },
  tooltipSpacer: {
    flex: 1,
  },
  tooltipNextButton: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 13,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipNextLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.white,
  },
});
