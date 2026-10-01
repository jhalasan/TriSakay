import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../../theme';
import { Avatar } from '../Avatar';
import { styles } from './IncomingCallScreen.styles';

export interface IncomingCallScreenProps {
  /** The caller's first name. Never a phone number. */
  name: string;
  avatarUrl?: string | null;
  eyebrow: string;
  subtitle: string;
  answerLabel: string;
  declineLabel: string;
  onAnswer: () => void;
  onDecline: () => void;
  busy?: boolean;
  topInset?: number;
  bottomInset?: number;
}

export function IncomingCallScreen({
  name,
  avatarUrl,
  eyebrow,
  subtitle,
  answerLabel,
  declineLabel,
  onAnswer,
  onDecline,
  busy = false,
  topInset = 0,
  bottomInset = 0,
}: IncomingCallScreenProps) {
  return (
    <View style={[styles.screen, { paddingTop: topInset, paddingBottom: Math.max(24, bottomInset + 12) }]}>
      <View style={styles.center}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Avatar name={name} source={avatarUrl ? { uri: avatarUrl } : undefined} size="xl" />
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={declineLabel}
            disabled={busy}
            onPress={onDecline}
            style={[styles.round, styles.declineRound]}
          >
            <Ionicons name="call" size={28} color={colors.white} style={styles.hangUpIcon} />
          </Pressable>
          <Text style={styles.actionLabel}>{declineLabel}</Text>
        </View>
        <View style={styles.action}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={answerLabel}
            disabled={busy}
            onPress={onAnswer}
            style={[styles.round, styles.answerRound]}
          >
            <Ionicons name="call" size={28} color={colors.white} />
          </Pressable>
          <Text style={styles.actionLabel}>{answerLabel}</Text>
        </View>
      </View>
    </View>
  );
}
