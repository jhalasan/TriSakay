import { StyleSheet } from 'react-native';
import { colors, elevation, fontFamily } from '../theme';

/** #9BD47F — a one-off literal: no existing token matches this exact light-green-on-near-black accent (same precedent as the tab-bar marker's literal radius). */
const FINISHED_GREEN = '#9BD47F';

export const styles = StyleSheet.create({
  finishedToast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 74,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 16,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 50,
    ...elevation.sheet,
  },
  finishedToastCheckTile: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(155, 212, 127, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishedToastCheckColor: {
    color: FINISHED_GREEN,
  },
  finishedToastMessage: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.white,
  },
  finishedToastRestart: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    lineHeight: 18,
    color: FINISHED_GREEN,
  },
});
