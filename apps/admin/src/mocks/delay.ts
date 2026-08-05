/** Simulates network latency for the mock service layer. Mirrors apps/driver/src/mocks/delay.ts. */
export function wait(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
