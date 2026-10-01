import { PermissionsAndroid, Platform } from 'react-native';
import {
  ChannelProfileType,
  ClientRoleType,
  ConnectionStateType,
  createAgoraRtcEngine,
  type IRtcEngine,
  type IRtcEngineEventHandler,
  type RtcConnection,
} from 'react-native-agora';

export interface CallEngineEvents {
  onRemoteJoined: () => void;
  onRemoteLeft: () => void;
  onConnectionLost: () => void;
  onConnectionRestored: () => void;
  onError: (message: string) => void;
}

export interface CallCredentials {
  appId: string;
  channel: string;
  uid: number;
  token: string;
}

export interface CallEngine {
  join: (credentials: CallCredentials) => void;
  setMuted: (muted: boolean) => void;
  setSpeaker: (on: boolean) => void;
  leave: () => void;
}

/** Asks for the microphone at call time. iOS prompts on first use of the audio engine itself. */
export async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/** A thin, audio-only wrapper around the Agora engine. One engine per call; `leave` releases it. */
export function createCallEngine(events: CallEngineEvents): CallEngine {
  const engine: IRtcEngine = createAgoraRtcEngine();
  let released = false;

  const handler: IRtcEngineEventHandler = {
    onUserJoined: () => events.onRemoteJoined(),
    onUserOffline: () => events.onRemoteLeft(),
    onConnectionStateChanged: (_connection: RtcConnection, state: ConnectionStateType) => {
      if (state === ConnectionStateType.ConnectionStateReconnecting) events.onConnectionLost();
      else if (state === ConnectionStateType.ConnectionStateConnected) events.onConnectionRestored();
      else if (state === ConnectionStateType.ConnectionStateFailed) events.onError('connection_failed');
    },
    onError: (_code, message) => events.onError(message),
  };

  return {
    join({ appId, channel, uid, token }) {
      engine.initialize({ appId, channelProfile: ChannelProfileType.ChannelProfileCommunication });
      engine.registerEventHandler(handler);
      engine.enableAudio();
      engine.setEnableSpeakerphone(false);
      engine.joinChannel(token, channel, uid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        autoSubscribeAudio: true,
      });
    },
    setMuted(muted) {
      if (!released) engine.muteLocalAudioStream(muted);
    },
    setSpeaker(on) {
      if (!released) engine.setEnableSpeakerphone(on);
    },
    leave() {
      if (released) return;
      released = true;
      engine.unregisterEventHandler(handler);
      engine.leaveChannel();
      engine.release();
    },
  };
}
