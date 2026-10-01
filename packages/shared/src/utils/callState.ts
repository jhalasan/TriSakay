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
