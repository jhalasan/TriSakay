import { Easing } from 'react-native';

/**
 * Shared timing so motion reads as one system. Everything eases OUT from an
 * already-visible default — content never fades in from nothing, it settles.
 */
export const motion = {
  duration: {
    /** Press feedback — must feel instant. */
    instant: 90,
    /** State changes within a screen. */
    quick: 180,
    /** Entrances and settling. */
    settle: 320,
    /** The ride-status pulse. */
    pulse: 1400,
  },
  easing: {
    /** Exponential ease-out: fast start, soft landing. */
    out: Easing.bezier(0.16, 1, 0.3, 1),
    inOut: Easing.bezier(0.65, 0, 0.35, 1),
    linear: Easing.linear,
  },
  /** Press scale for tappable surfaces. */
  pressScale: 0.97,
} as const;
