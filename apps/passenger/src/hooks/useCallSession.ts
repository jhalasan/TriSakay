import { useCallback, useEffect, useRef, useState } from 'react';
import {
  answerRideCall,
  declineRideCall,
  endRideCall,
  getCallToken,
  subscribeToCall,
  type RideCall,
} from '@trisakay/services';
import { callUiState, formatCallDuration, isCallFinished, type CallUiState } from '@trisakay/shared';
import { createCallEngine, ensureMicPermission, type CallEngine } from '../lib/callEngine';

export type CallFailure = 'mic_denied' | 'connection_failed' | null;

export interface CallSession {
  call: RideCall | null;
  /** False until the first answer from the server. */
  loaded: boolean;
  uiState: CallUiState;
  finished: boolean;
  /** "1:05" while connected. */
  timerText: string | undefined;
  muted: boolean;
  speaker: boolean;
  failure: CallFailure;
  actionError: string | null;
  busy: boolean;
  answer: () => Promise<void>;
  decline: () => Promise<void>;
  end: () => Promise<void>;
  toggleMute: () => void;
  toggleSpeaker: () => void;
}

function isActive(call: RideCall | null): boolean {
  return call?.status === 'ringing' || call?.status === 'answered';
}

/**
 * Everything one call screen needs: follows the call row on the server, joins the audio channel once the call is
 * answered (microphone permission, then a token, then Agora), reports mute/speaker state, and cleans up. The
 * server row is the source of truth for whether the call is on: if the other side leaves the audio channel, this
 * hangs up so both screens end together.
 */
export function useCallSession(callId: string | undefined): CallSession {
  const [call, setCall] = useState<RideCall | null>(null);
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [loaded, setLoaded] = useState(false);
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [connectionLost, setConnectionLost] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [failure, setFailure] = useState<CallFailure>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const engineRef = useRef<CallEngine | null>(null);
  const joiningRef = useRef(false);
  const callRef = useRef<RideCall | null>(null);
  callRef.current = call;

  useEffect(() => {
    if (!callId) {
      setLoaded(true);
      return;
    }
    return subscribeToCall(
      callId,
      (next) => {
        setCall(next);
        setFetchedAt(Date.now());
        setLoaded(true);
      },
      // A failed refetch is retried by the poll; only stop the spinner if nothing has ever loaded.
      () => {
        if (!callRef.current) setLoaded(true);
      },
    );
  }, [callId]);

  const active = isActive(call);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);

  const elapsedSeconds = Math.max(0, (now - fetchedAt) / 1000);
  const uiState = callUiState(
    call ? { status: call.status, isCaller: call.isCaller, ageSeconds: call.ageSeconds + elapsedSeconds } : null,
    { remoteJoined, connectionLost },
  );
  const finished = isCallFinished(uiState);
  const answeredSeconds = call?.answeredAgeSeconds != null ? call.answeredAgeSeconds + elapsedSeconds : null;
  const timerText = uiState === 'connected' && answeredSeconds != null ? formatCallDuration(answeredSeconds) : undefined;

  // Join the audio channel once the call is answered. Both sides do this; the token endpoint re-checks everything.
  useEffect(() => {
    if (!call || call.status !== 'answered' || joiningRef.current || engineRef.current) return;
    joiningRef.current = true;
    const id = call.id;

    (async () => {
      const granted = await ensureMicPermission();
      if (!granted) {
        setFailure('mic_denied');
        await endRideCall(id);
        return;
      }

      const { data, error } = await getCallToken(id);
      if (error || !data) {
        setFailure('connection_failed');
        await endRideCall(id);
        return;
      }

      // The call may have ended while the permission prompt or the token request was in flight.
      if (!isActive(callRef.current)) return;

      const engine = createCallEngine({
        onRemoteJoined: () => {
          setRemoteJoined(true);
          setConnectionLost(false);
        },
        // The other phone left the audio channel (hung up, app killed, network gone for good): end it for both.
        onRemoteLeft: () => {
          void endRideCall(id);
        },
        onConnectionLost: () => setConnectionLost(true),
        onConnectionRestored: () => setConnectionLost(false),
        // Agora also reports recoverable warnings here; a real failure shows up as a lost connection or the other
        // side leaving, which are handled above.
        onError: () => {},
      });
      engineRef.current = engine;
      engine.join(data);
    })();
  }, [call?.status, call?.id]);

  useEffect(() => {
    if (!finished) return;
    engineRef.current?.leave();
    engineRef.current = null;
  }, [finished]);

  // Leaving the screen ends whatever is still on: the caller cancels or hangs up, the callee declines or hangs up.
  useEffect(
    () => () => {
      engineRef.current?.leave();
      engineRef.current = null;
      const current = callRef.current;
      if (current && isActive(current)) {
        void (current.status === 'ringing' && !current.isCaller ? declineRideCall(current.id) : endRideCall(current.id));
      }
    },
    [],
  );

  const answer = useCallback(async () => {
    if (!callId) return;
    setBusy(true);
    setActionError(null);
    const { error } = await answerRideCall(callId);
    setBusy(false);
    if (error) setActionError(error);
  }, [callId]);

  const decline = useCallback(async () => {
    if (!callId) return;
    setBusy(true);
    const { error } = await declineRideCall(callId);
    setBusy(false);
    if (error) setActionError(error);
  }, [callId]);

  const end = useCallback(async () => {
    if (!callId) return;
    const { error } = await endRideCall(callId);
    if (error) setActionError(error);
  }, [callId]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    engineRef.current?.setMuted(next);
    setMuted(next);
  }, [muted]);

  const toggleSpeaker = useCallback(() => {
    const next = !speaker;
    engineRef.current?.setSpeaker(next);
    setSpeaker(next);
  }, [speaker]);

  return { call, loaded, uiState, finished, timerText, muted, speaker, failure, actionError, busy, answer, decline, end, toggleMute, toggleSpeaker };
}
