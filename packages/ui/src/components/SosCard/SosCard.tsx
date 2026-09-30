import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { AccessibilityInfo, Alert, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { colors, fontFamily, radius } from '../../theme';
import { Button } from '../Button';
import { HoldToConfirmButton } from '../HoldToConfirmButton';
import { IconTile } from '../IconTile';

export type SosCardState = 'idle' | 'sending' | 'sent' | 'failed';

export interface SosCardCopy {
  holdLabel: string;
  holdSub: string;
  title: string;
  sendingTitle: string;
  body: string;
  call911Title: string;
  call911Sub: string;
  sentTitle: string;
  /** Already includes the sent time. */
  sentBody: string;
  failedMessage: string;
  retry: string;
  a11yLabel: string;
  a11yHint: string;
  confirmTitle: string;
  confirmMessage: string;
  confirmButton: string;
  cancel: string;
}

export interface SosCardProps {
  state: SosCardState;
  copy: SosCardCopy;
  /** Called once the hold completes (or, with a screen reader running, after the confirm alert). */
  onSend: () => void;
  onCall911: () => void;
}

/** How long the SOS must be held (Privacy & Safety Center). The trip-screen SOS FAB keeps its own shorter hold. */
export const SOS_HOLD_MS = 2000;

/**
 * The Privacy & Safety Center's single press-and-hold SOS, with a separate
 * quiet 911 row. Sending / sent / failed replace the card contents in place.
 * Holding is hard with VoiceOver / TalkBack, so while a screen reader runs the
 * disc becomes a plain double-tap that asks for confirmation first.
 */
export function SosCard({ state, copy, onSend, onCall911 }: SosCardProps) {
  const [screenReader, setScreenReader] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => mounted && setScreenReader(enabled));
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  function handleConfirm() {
    Vibration.vibrate(60);
    onSend();
  }

  function handleAccessiblePress() {
    Alert.alert(copy.confirmTitle, copy.confirmMessage, [
      { text: copy.cancel, style: 'cancel' },
      { text: copy.confirmButton, style: 'destructive', onPress: onSend },
    ]);
  }

  if (state === 'sent') {
    return (
      <View style={[styles.card, styles.cardSent]}>
        <View style={styles.sentHalo}>
          <View style={styles.sentDisc}>
            <Ionicons name="checkmark" size={42} color={colors.accentGreenPressed} />
          </View>
        </View>
        <Text style={styles.sentTitle}>{copy.sentTitle}</Text>
        <Text style={styles.body}>{copy.sentBody}</Text>
        <View style={styles.fullWidth}>
          <Button label={copy.call911Title} tone="danger" fullWidth onPress={onCall911} />
        </View>
      </View>
    );
  }

  const sending = state === 'sending';

  return (
    <View style={styles.card}>
      <HoldToConfirmButton
        variant="disc"
        label={copy.holdLabel}
        sublabel={copy.holdSub}
        holdDurationMs={SOS_HOLD_MS}
        loading={sending}
        onConfirm={handleConfirm}
        accessibilityLabel={copy.a11yLabel}
        accessibilityHint={screenReader ? undefined : copy.a11yHint}
        onPress={screenReader ? handleAccessiblePress : undefined}
      />
      <Text style={styles.title}>{sending ? copy.sendingTitle : copy.title}</Text>

      {state === 'failed' ? (
        <View style={styles.failedStrip}>
          <Ionicons name="alert-circle" size={17} color={colors.dangerPressed} />
          <Text style={styles.failedText}>{copy.failedMessage}</Text>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={onSend} style={styles.retryButton}>
            <Text style={styles.retryText}>{copy.retry}</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.body}>{copy.body}</Text>
      )}

      <Pressable accessibilityRole="button" onPress={onCall911} style={styles.callRow}>
        <IconTile icon="call" tone="red" size={38} />
        <View style={styles.callBody}>
          <Text style={styles.callTitle}>{copy.call911Title}</Text>
          <Text style={styles.callSub}>{copy.call911Sub}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.inkSoft} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 24,
    paddingTop: 22,
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  cardSent: { borderColor: colors.accentGreen },
  fullWidth: { alignSelf: 'stretch' },
  title: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 23, color: colors.ink },
  body: { maxWidth: 290, textAlign: 'center', fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, color: colors.inkSoft },
  failedStrip: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.card,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  failedText: { flex: 1, fontFamily: fontFamily.regular, fontSize: 12.5, lineHeight: 18, color: colors.ink },
  retryButton: { minHeight: 44, justifyContent: 'center' },
  retryText: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 18, color: colors.dangerPressed },
  callRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  callBody: { flex: 1 },
  callTitle: { fontFamily: fontFamily.bold, fontSize: 14.5, lineHeight: 20, color: colors.ink },
  callSub: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: colors.inkSoft },
  sentHalo: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: 'rgba(233, 247, 227, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentDisc: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.accentGreenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentTitle: { fontFamily: fontFamily.extrabold, fontSize: 21, lineHeight: 27, color: colors.ink },
});
