import { Platform } from 'react-native';
import { colors } from './colors';

/**
 * Three tiers. Resting surfaces still lean on borders for their `flat`
 * state; `card`/`button` are for surfaces that should read as raised above
 * that baseline, and `sheet` is reserved for surfaces that genuinely float
 * (map bottom sheets, the log-out dialog). Every shadow carries an offset
 * and a soft blur — no zero-offset halos.
 *
 * Shadow color is tinted navy (`colors.accentBlue`) rather than generic
 * near-black — a "colored shadow" reads as premium and ties every raised
 * surface back to the brand mark's own navy, without touching any verified
 * text/background contrast pairing (shadows never sit behind text).
 */
export const elevation = {
  card: Platform.select({
    ios: {
      shadowColor: colors.accentBlue,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    android: { elevation: 3 },
    default: {},
  }),
  /** Solid/primary buttons — previously had zero shadow at any elevation. */
  button: Platform.select({
    ios: {
      shadowColor: colors.accentBlue,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 10,
    },
    android: { elevation: 4 },
    default: {},
  }),
  sheet: Platform.select({
    ios: {
      shadowColor: colors.accentBlue,
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.16,
      shadowRadius: 24,
    },
    android: { elevation: 12 },
    default: {},
  }),
} as const;
