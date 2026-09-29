import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { styles } from './ChatBubble.styles';

export interface ChatBubbleProps {
  /** True when the signed-in user sent this message — controls side, color and the read receipt. */
  sentByMe: boolean;
  kind: 'text' | 'quick_reply' | 'image';
  /** Already resolved to display text by the caller: raw trimmed text for `'text'`, the caller's own i18n lookup for `'quick_reply'`'s fixed code, and unused for `'image'`. */
  text?: string | null;
  /** A resolved (signed) URL for `kind:'image'` — this component never talks to Storage itself. */
  imageUri?: string | null;
  /** Already localized by the caller (e.g. "Number removed for your privacy"). */
  maskedNotice?: string | null;
  timeLabel: string;
  /** Shown only when `sentByMe` and the receiver has read it. */
  readLabel?: string | null;
  onLongPress?: () => void;
}

/** One message bubble — sent (right, accentBlue) or received (left, white/outlined). Shared by both apps since the visual language is identical; only the surrounding screen chrome differs per app. */
export function ChatBubble({ sentByMe, kind, text, imageUri, maskedNotice, timeLabel, readLabel, onLongPress }: ChatBubbleProps) {
  return (
    <View style={[styles.row, sentByMe ? styles.rowSent : styles.rowReceived]}>
      <Pressable
        style={[styles.bubble, sentByMe ? styles.bubbleSent : styles.bubbleReceived]}
        onLongPress={onLongPress}
        disabled={!onLongPress}
      >
        {kind === 'image' && imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        ) : (
          <Text style={[kind === 'quick_reply' ? styles.quickReplyText : styles.bodyText, sentByMe ? styles.bodyTextSent : styles.bodyTextReceived]}>
            {text}
          </Text>
        )}
        {maskedNotice && <Text style={[styles.maskedNotice, sentByMe ? styles.maskedNoticeSent : styles.maskedNoticeReceived]}>{maskedNotice}</Text>}
        <View style={styles.metaRow}>
          <Text style={[styles.timeText, sentByMe ? styles.timeTextSent : styles.timeTextReceived]}>{timeLabel}</Text>
          {sentByMe && readLabel && (
            <>
              <Ionicons name="checkmark-done" size={12} color="rgba(255,255,255,0.75)" />
              <Text style={[styles.timeText, styles.timeTextSent]}>{readLabel}</Text>
            </>
          )}
        </View>
      </Pressable>
    </View>
  );
}
