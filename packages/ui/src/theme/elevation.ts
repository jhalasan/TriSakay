import { Platform } from 'react-native';

/**
 * Two levels only. Resting surfaces lean on borders, not shadow; `sheet` is
 * reserved for surfaces that genuinely float (map bottom sheets, the log-out
 * dialog). Every shadow carries an offset and a soft blur — no zero-offset
 * halos.
 */
export const elevation = {
  card: Platform.select({
    ios: {
      shadowColor: '#0A1218',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
    },
    android: { elevation: 2 },
    default: {},
  }),
  sheet: Platform.select({
    ios: {
      shadowColor: '#0A1218',
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.14,
      shadowRadius: 24,
    },
    android: { elevation: 12 },
    default: {},
  }),
} as const;
