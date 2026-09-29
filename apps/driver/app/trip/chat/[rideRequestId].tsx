import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { getSignedDocumentUrl, reportMessage, sendPhotoMessage, sendQuickReply, sendTextMessage, sendTypingBroadcast, type RideMessage } from '@trisakay/services';
import { Avatar, ChatBubble, ChatComposer, EmptyState, QuickReplyRow, TypingDots, colors } from '@trisakay/ui';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { useTranslation } from '../../../src/hooks/useTranslation';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { useChatStore } from '../../../src/store/useChatStore';
import { useTripStore } from '../../../src/store/useTripStore';
import { preparePhotoForChat } from '../../../src/utils/preparePhotoForChat';
import { styles } from '../../../src/styles/trip/chat.styles';

const QUICK_REPLY_CODES = ['im_here', 'on_my_way', 'arriving_2_min'] as const;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

export default function DriverChatScreen() {
  const { rideRequestId } = useLocalSearchParams<{ rideRequestId: string }>();
  const t = useTranslation();
  const user = useAuthStore((state) => state.user);
  const passenger = useTripStore((state) => state.current?.passengers.find((p) => p.id === rideRequestId) ?? null);
  const messages = useChatStore((state) => state.messages);
  const loading = useChatStore((state) => state.loading);
  const chatError = useChatStore((state) => state.error);
  const otherPartyTyping = useChatStore((state) => state.otherPartyTyping);
  const connect = useChatStore((state) => state.connect);
  const disconnect = useChatStore((state) => state.disconnect);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const listRef = useRef<FlatList<RideMessage>>(null);

  useEffect(() => {
    if (!rideRequestId || !user) return;
    connect(rideRequestId, user.id);
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideRequestId, user?.id]);

  useEffect(() => {
    const missing = messages.filter((m) => m.kind === 'image' && m.imagePath && !signedUrls[m.imagePath]);
    if (missing.length === 0) return;
    (async () => {
      const entries = await Promise.all(
        missing.map(async (m) => {
          const { url } = await getSignedDocumentUrl('ride-chat', m.imagePath!);
          return [m.imagePath!, url] as const;
        })
      );
      setSignedUrls((prev) => {
        const next = { ...prev };
        for (const [path, url] of entries) if (url) next[path] = url;
        return next;
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0) listRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  function quickReplyLabel(code: string): string {
    return (t.driver.chat.quickReplies as Record<string, string>)[code] ?? code;
  }

  function messageText(message: RideMessage): string | undefined {
    if (message.kind === 'text') return message.body ?? undefined;
    if (message.kind === 'quick_reply') return quickReplyLabel(message.body ?? '');
    return undefined;
  }

  async function handleSend() {
    if (!rideRequestId || sending || draft.trim().length === 0) return;
    setSending(true);
    setSendError(null);
    const { error } = await sendTextMessage(rideRequestId, draft);
    setSending(false);
    if (error) {
      setSendError(t.driver.chat.sendFailed);
      return;
    }
    setDraft('');
  }

  async function handleQuickReply(code: string) {
    if (!rideRequestId || sending) return;
    setSending(true);
    setSendError(null);
    const { error } = await sendQuickReply(rideRequestId, code);
    setSending(false);
    if (error) setSendError(t.driver.chat.sendFailed);
  }

  async function handleAttachPhoto() {
    if (!rideRequestId || sending) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t.driver.chat.photoPermissionTitle, t.driver.chat.photoPermissionMessage);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;

    setSending(true);
    setSendError(null);
    try {
      const photo = await preparePhotoForChat(result.assets[0].uri);
      const { error } = await sendPhotoMessage({ rideRequestId, ...photo });
      if (error) setSendError(t.driver.chat.photoUploadFailed);
    } catch {
      setSendError(t.driver.chat.photoUploadFailed);
    } finally {
      setSending(false);
    }
  }

  function handleChangeText(text: string) {
    setDraft(text);
    if (rideRequestId && user) void sendTypingBroadcast(rideRequestId, user.id);
  }

  function handleLongPressMessage(message: RideMessage) {
    if (!rideRequestId || message.senderId === user?.id) return;
    Alert.alert(t.driver.chat.reportConfirmTitle, t.driver.chat.reportConfirmMessage, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.driver.chat.reportMessage,
        style: 'destructive',
        onPress: async () => {
          const { error } = await reportMessage({ rideRequestId, messageBody: messageText(message) ?? null });
          Alert.alert(error ? t.driver.chat.reportFailed : t.driver.chat.reportSent);
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title={passenger?.passengerName || t.driver.tripActive.passengerFallback}
        right={<Avatar name={passenger?.passengerName ?? undefined} source={passenger?.passengerAvatarUrl ? { uri: passenger.passengerAvatarUrl } : undefined} size="sm" />}
      />
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {chatError && <Text style={styles.error}>{chatError}</Text>}
        {sendError && <Text style={styles.error}>{sendError}</Text>}

        {!loading && messages.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState title={t.driver.chat.emptyTitle} message={t.driver.chat.emptyMessage} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => (
              <ChatBubble
                sentByMe={item.senderId === user?.id}
                kind={item.kind === 'system' ? 'text' : item.kind}
                text={messageText(item)}
                imageUri={item.imagePath ? signedUrls[item.imagePath] : undefined}
                maskedNotice={item.containsMaskedPhone ? t.driver.chat.maskedNotice : undefined}
                timeLabel={formatTime(item.createdAt)}
                readLabel={item.readAt ? t.driver.chat.seen : undefined}
                onLongPress={() => handleLongPressMessage(item)}
              />
            )}
          />
        )}

        {otherPartyTyping && (
          <View style={styles.typingRow}>
            <TypingDots color={colors.inkSoft} />
          </View>
        )}

        <QuickReplyRow options={QUICK_REPLY_CODES.map((code) => ({ code, label: quickReplyLabel(code) }))} onSelect={handleQuickReply} disabled={sending} />
        <ChatComposer
          value={draft}
          onChangeText={handleChangeText}
          onSend={handleSend}
          onAttachPhoto={handleAttachPhoto}
          sending={sending}
          placeholder={t.driver.chat.inputPlaceholder}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
