import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../../theme';
import { Avatar } from '../Avatar';
import { Button } from '../Button';
import { styles } from './InCallScreen.styles';

export interface InCallScreenProps {
  /** The other person's first name. Never a phone number. */
  name: string;
  avatarUrl?: string | null;
  stateText: string;
  /** Shown while connected, e.g. "1:05". */
  timerText?: string;
  errorText?: string | null;
  /** True once the call is over: the controls give way to a Close button. */
  finished: boolean;
  muted: boolean;
  speaker: boolean;
  muteLabel: string;
  unmuteLabel: string;
  speakerLabel: string;
  endLabel: string;
  closeLabel: string;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onEnd: () => void;
  onClose: () => void;
  topInset?: number;
  bottomInset?: number;
}

export function InCallScreen({
  name,
  avatarUrl,
  stateText,
  timerText,
  errorText,
  finished,
  muted,
  speaker,
  muteLabel,
  unmuteLabel,
  speakerLabel,
  endLabel,
  closeLabel,
  onToggleMute,
  onToggleSpeaker,
  onEnd,
  onClose,
  topInset = 0,
  bottomInset = 0,
}: InCallScreenProps) {
  return (
    <View style={[styles.screen, { paddingTop: topInset, paddingBottom: Math.max(24, bottomInset + 12) }]}>
      <View style={styles.center}>
        <Avatar name={name} source={avatarUrl ? { uri: avatarUrl } : undefined} size="xl" />
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.state}>{stateText}</Text>
        {timerText ? <Text style={styles.timer}>{timerText}</Text> : null}
        {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
      </View>

      {finished ? (
        <View style={styles.closeWrap}>
          <Button label={closeLabel} fullWidth onPress={onClose} />
        </View>
      ) : (
        <View style={styles.controls}>
          <View style={styles.control}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={muted ? unmuteLabel : muteLabel}
              accessibilityState={{ selected: muted }}
              onPress={onToggleMute}
              style={[styles.toggle, muted ? styles.toggleOn : styles.toggleOff]}
            >
              <Ionicons name={muted ? 'mic-off' : 'mic'} size={24} color={muted ? colors.white : colors.accentBlue} />
            </Pressable>
            <Text style={styles.controlLabel}>{muted ? unmuteLabel : muteLabel}</Text>
          </View>
          <View style={styles.control}>
            <Pressable accessibilityRole="button" accessibilityLabel={endLabel} onPress={onEnd} style={styles.endRound}>
              <Ionicons name="call" size={28} color={colors.white} style={styles.hangUpIcon} />
            </Pressable>
            <Text style={styles.controlLabel}>{endLabel}</Text>
          </View>
          <View style={styles.control}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={speakerLabel}
              accessibilityState={{ selected: speaker }}
              onPress={onToggleSpeaker}
              style={[styles.toggle, speaker ? styles.toggleOn : styles.toggleOff]}
            >
              <Ionicons name="volume-high" size={24} color={speaker ? colors.white : colors.accentBlue} />
            </Pressable>
            <Text style={styles.controlLabel}>{speakerLabel}</Text>
          </View>
        </View>
      )}
    </View>
  );
}
