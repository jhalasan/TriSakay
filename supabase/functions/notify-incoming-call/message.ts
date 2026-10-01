// Pure helpers for notify-incoming-call (node-testable, see message.test.ts).

/** Role only, from the receiver's point of view. No name, no number. */
export function incomingCallTitle(calleeIsPassenger: boolean): string {
  return calleeIsPassenger ? 'Incoming call from your driver' : 'Incoming call from your passenger';
}

/** A ring lasts 30 seconds; a push delivered more than a minute after the call was placed is stale. */
export function isFreshRing(createdAtIso: string, nowMs: number): boolean {
  const created = Date.parse(createdAtIso);
  if (Number.isNaN(created)) return false;
  return nowMs - created <= 60_000;
}
