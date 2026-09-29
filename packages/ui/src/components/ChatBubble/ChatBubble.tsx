import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { styles } from './ChatBubble.styles';

export type ChatBubbleGroupPosition = 'single' | 'first' | 'middle' | 'last';

/**
 * Structurally identical to `@trisakay/shared`'s `ChatTextSegment` (from
 * `splitMaskedPhoneBody`) but redeclared here rather than imported — no
 * package in this monorepo depends on another package today, and one
 * component's text-segment shape isn't worth being the first. The caller
 * (which already depends on `@trisakay/shared`) computes these and passes
 * them straight through.
 */
export type ChatBubbleTextSegment = { type: 'text'; value: string } | { type: 'maskedToken' };

export interface ChatBubbleProps {
  /** True when the signed-in user sent this message — controls side, color and the read receipt. */
  sentByMe: boolean;
  kind: 'text' | 'quick_reply' | 'image';
  /** Already resolved to display text by the caller: raw trimmed text for `'text'`, the caller's own i18n lookup for `'quick_reply'`'s fixed code, and unused for `'image'`. */
  text?: string | null;
  /** A resolved (signed) URL for `kind:'image'` — this component never talks to Storage itself. Absent while the URL is still loading shows a placeholder tile. */
  imageUri?: string | null;
  onPressImage?: () => void;
  /** Pre-split by the caller via `splitMaskedPhoneBody(text)` — present only when `text` contained the masked-phone marker. Each `'maskedToken'` segment renders as its own inline "number hidden" chip. */
  segments?: ChatBubbleTextSegment[] | null;
  /** The token's accessibilityLabel (e.g. "Number removed for your privacy"). */
  maskedTokenLabel?: string;
  /** The localized "number hidden" token text (Part C §C4). */
  maskedTokenText?: string;
  /** Where this bubble sits in a run of consecutive same-sender messages (Part C §C4) — controls the tail corner. Defaults to `'single'` for callers that don't group yet. */
  groupPosition?: ChatBubbleGroupPosition;
  /** Report-sheet open state (Part C §C4): scales the bubble up and adds a shadow while its report sheet is open above the scrim. */
  lifted?: boolean;
  onLongPress?: () => void;
  /**
   * @deprecated Superseded by the screen's own timestamp row (Part C §C4) —
   * time and the read receipt no longer render inside the bubble. Kept only
   * so call sites that haven't moved to `buildChatRows` yet still typecheck.
   */
  timeLabel?: string;
  /** @deprecated See `timeLabel`. */
  readLabel?: string | null;
  /** @deprecated Superseded by `segments` + `maskedTokenText` (Part C §C4) — the separate italic notice line is gone; the inline token is the notice now. Kept only so call sites that haven't moved to `segments` yet still typecheck. */
  maskedNotice?: string | null;
}

function tailRadii(sentByMe: boolean, groupPosition: ChatBubbleGroupPosition) {
  const hasAbove = groupPosition === 'middle' || groupPosition === 'last';
  const tightCorner = hasAbove ? 6 : 18;
  return sentByMe
    ? { borderTopRightRadius: tightCorner, borderBottomRightRadius: 6 }
    : { borderTopLeftRadius: tightCorner, borderBottomLeftRadius: 6 };
}

/** One message bubble — sent (right, accentBlue) or received (left, white/outlined). Shared by both apps since the visual language is identical; only the surrounding screen chrome differs per app. */
export function ChatBubble({
  sentByMe,
  kind,
  text,
  imageUri,
  onPressImage,
  segments = null,
  maskedTokenLabel,
  maskedTokenText,
  groupPosition = 'single',
  lifted = false,
  onLongPress,
}: ChatBubbleProps) {
  const isQuickReply = kind === 'quick_reply';
  const bubbleToneStyle = sentByMe
    ? isQuickReply
      ? styles.bubbleSentQuickReply
      : styles.bubbleSent
    : isQuickReply
      ? styles.bubbleReceivedQuickReply
      : styles.bubbleReceived;
  const textToneStyle = sentByMe ? styles.bodyTextSent : isQuickReply ? styles.quickReplyTextReceived : styles.bodyTextReceived;

  return (
    <View style={[styles.row, sentByMe ? styles.rowSent : styles.rowReceived]}>
      {/* Shadow lives on this wrapper, not the bubble itself — the bubble also
          carries `overflow:'hidden'` for image messages, and a shadow on the
          same view as overflow:'hidden' clips to an unrounded rectangle on
          Android (Part C hard rule 4). */}
      <View style={lifted && styles.liftedWrap}>
        <Pressable
          style={[styles.bubble, bubbleToneStyle, tailRadii(sentByMe, groupPosition), lifted && styles.bubbleLiftedScale, kind === 'image' && styles.bubbleImage]}
          onLongPress={onLongPress}
          disabled={!onLongPress}
        >
        {kind === 'image' ? (
          <Pressable onPress={onPressImage} disabled={!onPressImage || !imageUri}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={30} color={colors.lineStrong} />
              </View>
            )}
          </Pressable>
        ) : (
          <View style={styles.bodyRow}>
            {isQuickReply && <Ionicons name="flash" size={12} color={sentByMe ? colors.accentBlueSoft : colors.accentBlue} />}
            {segments ? (
              <View style={styles.segmentedWrap}>
                {segments.map((segment, i) =>
                  segment.type === 'text' ? (
                    <Text key={i} style={[isQuickReply ? styles.quickReplyText : styles.bodyText, textToneStyle]}>
                      {segment.value}
                    </Text>
                  ) : (
                    <View
                      key={i}
                      style={[styles.maskedToken, sentByMe ? styles.maskedTokenSent : styles.maskedTokenReceived]}
                      accessibilityLabel={maskedTokenLabel}
                    >
                      <Ionicons name="shield-outline" size={11} color={sentByMe ? colors.white : colors.inkSoft} />
                      <Text style={[styles.maskedTokenText, sentByMe ? styles.maskedTokenTextSent : styles.maskedTokenTextReceived]}>
                        {maskedTokenText}
                      </Text>
                    </View>
                  )
                )}
              </View>
            ) : (
              <Text style={[isQuickReply ? styles.quickReplyText : styles.bodyText, textToneStyle, styles.bodyTextFlex]}>{text}</Text>
            )}
          </View>
        )}
        </Pressable>
      </View>
    </View>
  );
}
