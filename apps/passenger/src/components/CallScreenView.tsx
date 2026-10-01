import { useEffect } from 'react';
import { ActivityIndicator, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IncomingCallScreen, InCallScreen, colors } from '@trisakay/ui';
import type { CallUiState } from '@trisakay/shared';
import { useTranslation } from '../hooks/useTranslation';
import { useCallSession } from '../hooks/useCallSession';

/** One screen for every state of a call: the answer screen while it rings for you, the in-call screen otherwise. */
export function CallScreenView({ callId, onClose }: { callId: string | undefined; onClose: () => void }) {
  const t = useTranslation().callUi;
  const insets = useSafeAreaInsets();
  const session = useCallSession(callId);
  const { call, uiState, finished } = session;

  // Ring the phone while someone is calling and the app is open (the push covers the closed-app case).
  useEffect(() => {
    if (uiState !== 'incoming') return;
    Vibration.vibrate([0, 600, 400], true);
    return () => Vibration.cancel();
  }, [uiState]);

  // A finished call closes itself after a moment, unless there is something the person should read.
  useEffect(() => {
    if (!finished || session.failure || session.actionError) return;
    const timer = setTimeout(onClose, 1800);
    return () => clearTimeout(timer);
  }, [finished, session.failure, session.actionError, onClose]);

  if (!session.loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accentBlue} />
      </View>
    );
  }

  const name = call?.peerFirstName ?? t.unknownCaller;
  const avatarUrl = call?.peerAvatarUrl ?? null;

  if (uiState === 'incoming') {
    return (
      <IncomingCallScreen
        name={name}
        avatarUrl={avatarUrl}
        eyebrow={t.incomingEyebrow}
        subtitle={t.incomingSubtitle}
        answerLabel={t.answer}
        declineLabel={t.decline}
        onAnswer={session.answer}
        onDecline={session.decline}
        busy={session.busy}
        topInset={insets.top}
        bottomInset={insets.bottom}
      />
    );
  }

  const stateText: Record<Exclude<CallUiState, 'incoming'>, string> = {
    calling: t.stateCalling,
    connecting: t.stateConnecting,
    connected: t.stateConnected,
    reconnecting: t.stateReconnecting,
    declined: t.stateDeclined,
    no_answer: t.stateNoAnswer,
    cancelled: t.stateCancelled,
    ended: t.stateEnded,
  };

  const errorText =
    session.failure === 'mic_denied'
      ? `${t.micDeniedTitle}. ${t.micDeniedBody}`
      : session.failure === 'connection_failed'
        ? t.connectionFailed
        : session.actionError;

  return (
    <InCallScreen
      name={name}
      avatarUrl={avatarUrl}
      stateText={stateText[uiState as Exclude<CallUiState, 'incoming'>]}
      timerText={session.timerText}
      errorText={errorText}
      finished={finished}
      muted={session.muted}
      speaker={session.speaker}
      muteLabel={t.mute}
      unmuteLabel={t.unmute}
      speakerLabel={t.speaker}
      endLabel={t.end}
      closeLabel={t.close}
      onToggleMute={session.toggleMute}
      onToggleSpeaker={session.toggleSpeaker}
      onEnd={session.end}
      onClose={onClose}
      topInset={insets.top}
      bottomInset={insets.bottom}
    />
  );
}
