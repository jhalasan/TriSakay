// Pure helpers for call-token, free of Deno APIs so they can be unit-tested with node (see authorize.test.ts).

export interface CallRow {
  status: string;
  caller_id: string;
  callee_id: string;
}

export interface RideRow {
  status: string;
  passenger_id: string;
  driver_id: string | null;
}

export type Authorization = { ok: true } | { ok: false; status: number; error: string };

/**
 * May this user get Agora credentials for this call right now? Checked against the server's own rows on every
 * request: a stranger, an ended call, a ride that is no longer active, or a ride whose driver changed all get
 * refused. The callee must have answered first; the caller may join while it rings.
 */
export function authorizeCallToken(userId: string, call: CallRow | null, ride: RideRow | null): Authorization {
  if (!call) return { ok: false, status: 404, error: 'Call not found' };
  if (userId !== call.caller_id && userId !== call.callee_id) {
    return { ok: false, status: 403, error: 'This call is not yours' };
  }
  if (call.status !== 'ringing' && call.status !== 'answered') {
    return { ok: false, status: 409, error: 'This call has ended' };
  }
  if (userId === call.callee_id && call.status !== 'answered') {
    return { ok: false, status: 409, error: 'Answer the call first' };
  }
  if (!ride || (ride.status !== 'assigned' && ride.status !== 'ongoing')) {
    return { ok: false, status: 409, error: 'This ride is no longer active' };
  }
  const parties = new Set([call.caller_id, call.callee_id]);
  if (!ride.driver_id || !parties.has(ride.passenger_id) || !parties.has(ride.driver_id)) {
    return { ok: false, status: 409, error: 'This call no longer matches the ride' };
  }
  return { ok: true };
}

/** A random positive 31-bit id for the audio channel, so no name or phone number is ever used as an identity. */
export function randomUid(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return (buffer[0] % 2147483646) + 1;
}
