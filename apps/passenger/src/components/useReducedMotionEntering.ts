import { useReducedMotion } from 'react-native-reanimated';

/**
 * Builds a reanimated `entering` animation via `factory()`, or returns
 * `undefined` (render at rest — no entrance) when the OS's reduced-motion
 * accessibility setting is on.
 */
export function useReducedMotionEntering<T>(factory: () => T): T | undefined {
  const reducedMotion = useReducedMotion();
  return reducedMotion ? undefined : factory();
}
