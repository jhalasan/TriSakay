/**
 * Fares are quoted by the backend — they depend on the routed distance, the
 * operator's tariff, and local ordinance, none of which the client can know.
 * Returns null so screens show a placeholder instead of a plausible-looking
 * peso amount that nothing stands behind.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function estimateFare(seats: number): number | null {
  return null;
}
