import { colors } from './colors';

/**
 * Gradient stop pairs, built only from colors already verified in
 * `colors.ts` (plus one darker navy shade for the hero pair — same hue,
 * no new contrast pairing to check since it never sits behind text on its
 * own, only behind the white lockup/wordmark).
 *
 * Consumed via `GradientSurface` — screens pass a token name, gradient
 * logic (react-native-svg) lives in exactly one place.
 */
export const gradients = {
  /** Full-bleed brand surfaces: splash, auth hero band. */
  hero: [colors.accentBlue, '#001A38'] as const,
  /** The logo's own two-tone split (navy ring → green chevron). Used sparingly. */
  brand: [colors.accentBlue, colors.accentGreen] as const,
  /** Primary solid button fill — within the already-verified pressed-state pair. */
  button: [colors.accentBlue, colors.accentBluePressed] as const,
  /** Emergency screen only — the one surface allowed to go red. */
  sos: [colors.danger, colors.dangerDeep] as const,
} as const;

export type GradientToken = keyof typeof gradients;
