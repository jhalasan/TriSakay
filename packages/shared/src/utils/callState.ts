export const RING_WINDOW_SECONDS = 30;

export type CallStatus = 'ringing' | 'answered' | 'declined' | 'cancelled' | 'missed' | 'ended';

export type CallUiState =
  | 'incoming'
  | 'calling'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'declined'
  | 'no_answer'
  | 'cancelled'
  | 'ended';

export interface CallStateInput {
  status: CallStatus;
  isCaller: boolean;
  /** Seconds since the call was created, already corrected for the time passed since it was fetched. */
  ageSeconds: number;
}

export interface CallEngineState {
  remoteJoined: boolean;
  connectionLost: boolean;
}

/** What the call screen should show, from the server's call row plus what the audio engine reports. */
export function callUiState(call: CallStateInput | null, engine: CallEngineState): CallUiState {
  if (!call) return 'ended';
  switch (call.status) {
    case 'ringing':
      if (call.ageSeconds >= RING_WINDOW_SECONDS) return 'no_answer';
      return call.isCaller ? 'calling' : 'incoming';
    case 'answered':
      if (engine.connectionLost) return 'reconnecting';
      return engine.remoteJoined ? 'connected' : 'connecting';
    case 'declined':
      return 'declined';
    case 'missed':
      return 'no_answer';
    case 'cancelled':
      return 'cancelled';
    case 'ended':
      return 'ended';
  }
}

export function isCallFinished(state: CallUiState): boolean {
  return state === 'declined' || state === 'no_answer' || state === 'cancelled' || state === 'ended';
}

/** "m:ss", or "h:mm:ss" past an hour. */
export function formatCallDuration(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}

/** The audio is meant to be up but is not: the call screen gives up on it after a short while instead of waiting forever. */
export function isStalled(state: CallUiState): boolean {
  return state === 'connecting' || state === 'reconnecting';
}

/** How long to wait for the audio before giving up on a connecting or reconnecting call. */
export const CONNECT_GIVE_UP_SECONDS = 20;

/** False while the app is still starting up through its splash screen (a notification tap must not navigate yet). */
export function isPastSplash(pathname: string | undefined): boolean {
  return !!pathname && pathname !== '/' && !pathname.startsWith('/splash');
}

/** Polls `condition` until it is true (resolves true) or `timeoutMs` passes (resolves false). */
export function waitUntil(
  condition: () => boolean,
  { intervalMs = 250, timeoutMs = 10_000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<boolean> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const tick = () => {
      if (condition()) return resolve(true);
      if (Date.now() - startedAt >= timeoutMs) return resolve(false);
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}
