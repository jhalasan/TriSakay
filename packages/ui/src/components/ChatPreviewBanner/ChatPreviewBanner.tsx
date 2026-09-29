import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../Avatar';
import { colors } from '../../theme';
import { styles } from './ChatPreviewBanner.styles';

export interface ChatPreviewBannerProps {
  /** "{firstName} · {stage label}" — already composed by the caller. */
  title: string;
  avatarUrl?: string | null;
  /** Already resolved by the caller: message body, a localized quick-reply label, or the "Photo" string. */
  previewText: string;
  isPhoto?: boolean;
  replyLabel: string;
  onPress: () => void;
  /** `insets.top + 76` per README §4.4/Part B §B7 — below the status pill. */
  topOffset: number;
}

/**
 * README §4.4 / Part B §B7 — a transient banner shown on the active-trip
 * (driver) and matched-ride (passenger) screens when a chat message arrives
 * while that screen is focused and the chat itself isn't open. Shared
 * because both parts use the identical shape; only the caller's data
 * (subscription source, stage label) differs per app.
 */
export function ChatPreviewBanner({ title, avatarUrl, previewText, isPhoto = false, replyLabel, onPress, topOffset }: ChatPreviewBannerProps) {
  return (
    <Pressable style={[styles.banner, { top: topOffset }]} accessibilityRole="button" onPress={onPress}>
      <Avatar name={title} source={avatarUrl ? { uri: avatarUrl } : undefined} size="md" />
      <View style={styles.textColumn}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        <View style={styles.previewRow}>
          {isPhoto && <Ionicons name="image-outline" size={13} color={colors.inkSoft} />}
          <Text numberOfLines={1} style={styles.preview}>
            {previewText}
          </Text>
        </View>
      </View>
      <View style={styles.replyButton}>
        <Text style={styles.replyText}>{replyLabel}</Text>
      </View>
    </Pressable>
  );
}
