/**
 * Design values throughout this package were picked against a 375px-wide
 * canvas (iPhone standard width) — the baseline every mock and the numbers
 * below were tuned on. Scaling by the live device width keeps proportions
 * consistent from small phones (~320px) to large ones (~430px+).
 *
 * Pure and RN-free on purpose: callers pass the device width in rather than
 * this module reading `Dimensions` itself, so it can be unit-tested under
 * plain Node (this package's test runner can't load `react-native`, whose
 * entry point is Flow syntax, not something Node's module loader parses).
 */
const BASE_WIDTH = 375;

/**
 * `factor` dampens the scale so it's never fully linear with device width:
 * at `1` a tiny phone would shrink text as aggressively as the width ratio
 * itself, which reads as illegibly small long before the width difference
 * justifies it. `0.5` moves values only halfway toward the raw ratio.
 */
export function moderateScale(size: number, screenWidth: number, factor = 0.5): number {
  const ratio = screenWidth / BASE_WIDTH;
  return size + (size * ratio - size) * factor;
}
