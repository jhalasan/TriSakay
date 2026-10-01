import test from 'node:test';
import assert from 'node:assert/strict';
import { RING_WINDOW_SECONDS, callUiState, formatCallDuration, isCallFinished } from '../src/utils/callState.ts';

const engine = { remoteJoined: false, connectionLost: false };
const ring = (isCaller: boolean, ageSeconds: number) => ({ status: 'ringing' as const, isCaller, ageSeconds });

test('a ringing call is "calling" for the caller and "incoming" for the callee', () => {
  assert.equal(callUiState(ring(true, 3), engine), 'calling');
  assert.equal(callUiState(ring(false, 3), engine), 'incoming');
});

test('a ring older than the window shows as no answer on both sides', () => {
  assert.equal(callUiState(ring(true, RING_WINDOW_SECONDS), engine), 'no_answer');
  assert.equal(callUiState(ring(false, RING_WINDOW_SECONDS + 5), engine), 'no_answer');
  assert.equal(callUiState(ring(true, RING_WINDOW_SECONDS - 1), engine), 'calling');
});

test('an answered call is connecting, then connected once the other side is in, and reconnecting if the link drops', () => {
  const answered = { status: 'answered' as const, isCaller: true, ageSeconds: 10 };
  assert.equal(callUiState(answered, engine), 'connecting');
  assert.equal(callUiState(answered, { remoteJoined: true, connectionLost: false }), 'connected');
  assert.equal(callUiState(answered, { remoteJoined: true, connectionLost: true }), 'reconnecting');
});

test('final statuses map to their own states, and a missing call is ended', () => {
  const base = { isCaller: true, ageSeconds: 5 };
  assert.equal(callUiState({ ...base, status: 'declined' }, engine), 'declined');
  assert.equal(callUiState({ ...base, status: 'missed' }, engine), 'no_answer');
  assert.equal(callUiState({ ...base, status: 'cancelled' }, engine), 'cancelled');
  assert.equal(callUiState({ ...base, status: 'ended' }, engine), 'ended');
  assert.equal(callUiState(null, engine), 'ended');
});

test('isCallFinished is true only for the end states', () => {
  for (const s of ['declined', 'no_answer', 'cancelled', 'ended'] as const) assert.equal(isCallFinished(s), true);
  for (const s of ['incoming', 'calling', 'connecting', 'connected', 'reconnecting'] as const) assert.equal(isCallFinished(s), false);
});

test('formatCallDuration shows m:ss, floors seconds, never goes negative, and adds hours past 60 minutes', () => {
  assert.equal(formatCallDuration(0), '0:00');
  assert.equal(formatCallDuration(9.9), '0:09');
  assert.equal(formatCallDuration(65), '1:05');
  assert.equal(formatCallDuration(3599), '59:59');
  assert.equal(formatCallDuration(3661), '1:01:01');
  assert.equal(formatCallDuration(-4), '0:00');
});
