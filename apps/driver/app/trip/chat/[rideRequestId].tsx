import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { getSignedDocumentUrl, reportMessage, sendPhotoMessage, sendQuickReply, sendTextMessage, sendTypingBroadcast, type RideMessage } from '@trisakay/services';
import { buildChatRows, sortByNextStop, splitMaskedPhoneBody, type ChatRow, type ChatSystemKind } from '@trisakay/shared';
import {
  ChatBubble,
  ChatComposer,
  ChatErrorBar,
  ChatHeader,
  ChatReadOnlyBar,
  ChatReportSheet,
  ChatSystemPill,
  QuickReplyRow,
  TypingDots,
  colors,
  type ChatHeaderDotTone,
  type ChatSystemPillIcon,
} from '@trisakay/ui';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../../../src/hooks/useTranslation';
import { useChatPrivacyTip } from '../../../src/hooks/useChatPrivacyTip';
import { useUnreadByRide } from '../../../src/hooks/useUnreadByRide';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { useChatStore } from '../../../src/store/useChatStore';
import { useDriverStore } from '../../../src/store/useDriverStore';
import { useTripStore } from '../../../src/store/useTripStore';
import { preparePhotoForChat } from '../../../src/utils/preparePhotoForChat';
import { interpolate } from '../../../src/utils/interpolate';
import { styles } from '../../../src/styles/trip/chat.styles';

const QUICK_REPLY_CODES = ['im_here', 'on_my_way', 'arriving_2_min'] as const;

const SYSTEM_ICON: Record<ChatSystemKind, ChatSystemPillIcon> = {
  accepted: 'checkmark-circle',
  moved: 'swap-horizontal',
  arrived: 'location',
  completed: 'lock-closed',
  cancelled: 'lock-closed',
  raw: 'lock-closed',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

function firstNameOf(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function isRateLimitError(message: string) {
  return message.toLowerCase().includes('too quickly');
}

export default function DriverChatScreen() {
  const { rideRequestId } = useLocalSearchParams<{ rideRequestId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const user = useAuthStore((state) => state.user);
  const currentLat = useDriverStore((state) => state.currentLat);
  const currentLng = useDriverStore((state) => state.currentLng);
  const allPassengers = useTripStore((state) => state.current?.passengers ?? []);
  const passenger = allPassengers.find((p) => p.id === rideRequestId) ?? null;
  const activePassengers = useMemo(() => allPassengers.filter((p) => p.status === 'assigned' || p.status === 'ongoing'), [allPassengers]);
  const activePassengerIds = activePassengers.map((p) => p.id);

  const messages = useChatStore((state) => state.messages);
  const loading = useChatStore((state) => state.loading);
  const chatError = useChatStore((state) => state.error);
  const otherPartyTyping = useChatStore((state) => state.otherPartyTyping);
  const connect = useChatStore((state) => state.connect);
  const disconnect = useChatStore((state) => state.disconnect);
  const tip = useChatPrivacyTip();
  const unreadByRide = useUnreadByRide(activePassengerIds, user?.id);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<RideMessage | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reportToast, setReportToast] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatRow<RideMessage>>>(null);
  const lastFailedRef = useRef<{ type: 'text' } | { type: 'quick_reply'; code: string } | { type: 'photo' } | null>(null);

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

  const isReadOnly = passenger === null || (passenger.status !== 'assigned' && passenger.status !== 'ongoing');

  const rows = useMemo(
    () =>
      buildChatRows(
        messages,
        user?.id ?? '',
        {
          acceptedAt: passenger?.assignedAt ?? null,
          arrivedAt: passenger?.arrivedAt ?? null,
          endedAt: null,
          endedStatus: null,
        },
        { otherPartyTyping }
      ),
    [messages, user?.id, passenger?.assignedAt, passenger?.arrivedAt, otherPartyTyping]
  );

  useEffect(() => {
    if (rows.length > 0) listRef.current?.scrollToEnd({ animated: true });
  }, [rows.length]);

  function quickReplyLabel(code: string): string {
    return (t.driver.chat.quickReplies as Record<string, string>)[code] ?? code;
  }

  function messageText(message: RideMessage): string | undefined {
    if (message.kind === 'text') return message.body ?? undefined;
    if (message.kind === 'quick_reply') return quickReplyLabel(message.body ?? '');
    return undefined;
  }

  // Part C §C2: "Pickup next" vs plain "Pickup" — matches whether this
  // passenger is the driver's actual next stop under D2's own ordering
  // (`sortByNextStop`), reusing that pure function rather than a second,
  // possibly-inconsistent notion of "next."
  const isNextStop = useMemo(() => {
    if (!passenger || activePassengers.length < 2) return true;
    const driverPos = currentLat !== null && currentLng !== null ? { lat: currentLat, lng: currentLng } : null;
    const sorted = sortByNextStop(
      activePassengers.map((p) => ({
        id: p.id,
        status: p.status,
        pickupLat: p.pickupLat,
        pickupLng: p.pickupLng,
        destLat: p.destLat,
        destLng: p.destLng,
        assignedAt: p.assignedAt,
        pickedUpAt: p.pickedUpAt,
        distanceKm: p.distanceKm,
      })),
      driverPos,
      []
    );
    return sorted[0]?.passenger.id === passenger.id;
  }, [passenger, activePassengers, currentLat, currentLng]);

  function headerStatus(): { dot: ChatHeaderDotTone; text: string } {
    if (!passenger) return { dot: 'neutral', text: t.driver.chat.headerPickupPlain };
    if (passenger.status === 'ongoing') return { dot: 'blueSquare', text: t.driver.chat.headerOnBoardPlain };
    return { dot: 'greenRing', text: isNextStop ? t.driver.chat.headerPickupNextPlain : t.driver.chat.headerPickupPlain };
  }

  function systemText(kind: ChatSystemKind, at: string, body?: string): string {
    const time = formatTime(at);
    const name = passenger?.passengerName ?? '';
    switch (kind) {
      case 'accepted':
        return interpolate(t.driver.chat.sys.accepted, { name, time });
      case 'moved':
        return interpolate(t.driver.chat.sys.moved, { name, time });
      case 'arrived':
        return interpolate(t.driver.chat.sys.arrived, { time });
      case 'completed':
        return t.driver.chat.sys.completed;
      case 'cancelled':
        return t.driver.chat.sys.cancelled;
      case 'raw':
        return body ?? '';
    }
  }

  async function handleSend() {
    if (!rideRequestId || sending || draft.trim().length === 0) return;
    setSending(true);
    setSendError(null);
    lastFailedRef.current = { type: 'text' };
    const { error } = await sendTextMessage(rideRequestId, draft);
    setSending(false);
    if (error) {
      if (isRateLimitError(error)) {
        setRateLimited(true);
        setTimeout(() => setRateLimited(false), 10000);
      } else {
        setSendError(t.driver.chat.sendFailed);
      }
      return;
    }
    lastFailedRef.current = null;
    setDraft('');
  }

  async function handleQuickReply(code: string) {
    if (!rideRequestId || sending) return;
    setSending(true);
    setSendError(null);
    lastFailedRef.current = { type: 'quick_reply', code };
    const { error } = await sendQuickReply(rideRequestId, code);
    setSending(false);
    if (error) {
      if (isRateLimitError(error)) {
        setRateLimited(true);
        setTimeout(() => setRateLimited(false), 10000);
      } else {
        setSendError(t.driver.chat.sendFailed);
      }
      return;
    }
    lastFailedRef.current = null;
  }

  async function handleAttachPhoto() {
    if (!rideRequestId || sending) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;

    setSending(true);
    setSendError(null);
    lastFailedRef.current = { type: 'photo' };
    try {
      const photo = await preparePhotoForChat(result.assets[0].uri);
      const { error } = await sendPhotoMessage({ rideRequestId, ...photo });
      if (error) setSendError(t.driver.chat.photoUploadFailed);
      else lastFailedRef.current = null;
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

  function handleRetry() {
    setSendError(null);
    const failed = lastFailedRef.current;
    if (!failed) return;
    if (failed.type === 'text') void handleSend();
    else if (failed.type === 'quick_reply') void handleQuickReply(failed.code);
    else void handleAttachPhoto();
  }

  function handleReconnect() {
    if (!rideRequestId || !user) return;
    disconnect();
    connect(rideRequestId, user.id);
  }

  async function handleConfirmReport() {
    if (!reportTarget || !rideRequestId) return;
    setReporting(true);
    const { error } = await reportMessage({ rideRequestId, messageBody: messageText(reportTarget) ?? null });
    setReporting(false);
    setReportTarget(null);
    setReportToast(error ? t.driver.chat.reportFailed : t.driver.chat.reportDone);
    setTimeout(() => setReportToast(null), 3000);
  }

  function renderRow({ item }: { item: ChatRow<RideMessage> }) {
    if (item.type === 'day') {
      return (
        <View style={styles.daySeparatorRow}>
          <Text style={styles.daySeparator}>{item.day === 'today' ? t.driver.chat.today : item.day === 'yesterday' ? t.driver.chat.yesterday : item.dateLabel}</Text>
        </View>
      );
    }
    if (item.type === 'system') {
      return <ChatSystemPill icon={SYSTEM_ICON[item.kind]} text={systemText(item.kind, item.at, item.body)} />;
    }
    if (item.type === 'typing') {
      return (
        <View style={[styles.bubbleRow, styles.bubbleRowReceived]}>
          <View style={styles.typingBubble}>
            <TypingDots color={colors.lineStrong} />
          </View>
        </View>
      );
    }
    const m = item.message;
    const text = messageText(m);
    const segments = m.containsMaskedPhone && text ? splitMaskedPhoneBody(text) : null;
    return (
      <View>
        <ChatBubble
          sentByMe={item.sentByMe}
          kind={m.kind === 'system' ? 'text' : m.kind}
          text={segments ? undefined : text}
          segments={segments}
          maskedTokenText={t.driver.chat.numberHidden}
          maskedTokenLabel={t.driver.chat.maskedNotice}
          imageUri={m.imagePath ? signedUrls[m.imagePath] : undefined}
          onPressImage={() => {
            const uri = m.imagePath ? signedUrls[m.imagePath] : undefined;
            if (uri) setViewerUri(uri);
          }}
          groupPosition={item.groupPosition}
          lifted={reportTarget?.id === m.id}
          onLongPress={() => {
            if (m.senderId !== user?.id) setReportTarget(m);
          }}
        />
        {item.showTimestamp && (
          <View style={[styles.timestampRow, item.sentByMe ? styles.timestampRowSent : styles.timestampRowReceived]}>
            <Text style={styles.timestampText}>{formatTime(m.createdAt)}</Text>
            {item.showSeen && (
              <>
                <Ionicons name="checkmark-done" size={13} color={colors.accentGreen} />
                <Text style={styles.seenText}>{t.driver.chat.seen}</Text>
              </>
            )}
          </View>
        )}
      </View>
    );
  }

  const status = headerStatus();
  const showEmpty = !loading && messages.length === 0;
  const showSkeleton = loading && messages.length === 0;
  const passengerName = passenger?.passengerName || t.driver.tripActive.passengerFallback;

  return (
    <View style={styles.container}>
      <ChatHeader
        name={passengerName}
        avatarUrl={passenger?.passengerAvatarUrl}
        statusDot={status.dot}
        statusText={status.text}
        onBack={() => router.back()}
        topInset={insets.top}
        switcher={
          activePassengers.length >= 2
            ? {
                activeId: rideRequestId,
                onSelect: (id) => router.replace(`/trip/chat/${id}`),
                options: activePassengers.map((p) => ({
                  id: p.id,
                  label: interpolate(p.status === 'ongoing' ? t.driver.chat.switcherOnBoard : t.driver.chat.switcherPickup, {
                    name: p.passengerName ? firstNameOf(p.passengerName) : t.driver.tripActive.passengerFallback,
                  }),
                  unreadCount: unreadByRide[p.id] ?? 0,
                })),
              }
            : undefined
        }
      />

      {tip.visible && !isReadOnly && !showEmpty && (
        <View style={styles.privacyTip}>
          <Ionicons name="shield-checkmark" size={13} color={colors.accentBlue} />
          <Text style={styles.privacyTipText}>{t.driver.chat.tip}</Text>
          <Pressable accessibilityRole="button" hitSlop={16} onPress={tip.dismiss}>
            <Ionicons name="close" size={12} color={colors.inkSoft} />
          </Pressable>
        </View>
      )}

      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {chatError && <ChatErrorBar message={chatError} onRetry={handleReconnect} retryLabel={t.driver.chat.retry} />}

        {showEmpty ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconTile}>
              <Ionicons name="chatbubble-ellipses-outline" size={26} color={colors.accentBlue} />
            </View>
            <Text style={styles.emptyTitle}>{interpolate(t.driver.chat.emptyTitleNamed, { name: firstNameOf(passengerName) })}</Text>
            <Text style={styles.emptyBody}>{t.driver.chat.emptyBodyDriver}</Text>
            <View style={styles.emptyNoteRow}>
              <Ionicons name="shield-checkmark" size={12} color={colors.accentGreen} />
              <Text style={styles.emptyNoteText}>{t.driver.chat.emptyNote}</Text>
            </View>
          </View>
        ) : showSkeleton ? (
          <View style={styles.listContent}>
            {[60, 45, 70].map((width, i) => (
              <View key={i} style={[styles.skeletonRow, i % 2 === 1 && styles.skeletonRowSent]}>
                <View style={[styles.skeletonBubble, { width: `${width}%` }]} />
              </View>
            ))}
          </View>
        ) : (
          <FlatList ref={listRef} data={rows} keyExtractor={(item) => item.id} contentContainerStyle={styles.listContent} renderItem={renderRow} />
        )}

        {sendError && <ChatErrorBar message={sendError} onRetry={handleRetry} retryLabel={t.driver.chat.retry} />}
        {rateLimited && <ChatErrorBar message={t.driver.chat.rateLimited} />}

        {isReadOnly ? (
          <ChatReadOnlyBar
            message={t.driver.chat.readOnly}
            reportLabel={t.driver.chat.reportRide}
            onReport={() => router.push(`/complaints?rideRequestId=${rideRequestId}`)}
            bottomInset={insets.bottom}
          />
        ) : (
          <>
            <QuickReplyRow options={QUICK_REPLY_CODES.map((code) => ({ code, label: quickReplyLabel(code) }))} onSelect={handleQuickReply} disabled={sending} size="lg" />
            <ChatComposer
              value={draft}
              onChangeText={handleChangeText}
              onSend={handleSend}
              onAttachPhoto={handleAttachPhoto}
              sending={sending}
              placeholder={interpolate(t.driver.chat.inputPlaceholderNamed, { name: firstNameOf(passengerName) })}
            />
          </>
        )}
      </KeyboardAvoidingView>

      <ChatReportSheet
        visible={!!reportTarget}
        title={t.driver.chat.reportTitle}
        fromLabel={reportTarget ? interpolate(t.driver.chat.reportFrom, { name: passengerName, time: formatTime(reportTarget.createdAt) }) : ''}
        body={t.driver.chat.reportBody}
        reportLabel={t.driver.chat.reportMessage}
        cancelLabel={t.common.cancel}
        loading={reporting}
        onReport={handleConfirmReport}
        onCancel={() => setReportTarget(null)}
        bottomInset={insets.bottom}
      />

      {reportToast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{reportToast}</Text>
        </View>
      )}

      <Modal visible={!!viewerUri} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
        <View style={styles.viewerBackdrop}>
          <Pressable accessibilityRole="button" style={[styles.viewerClose, { top: insets.top + 12 }]} onPress={() => setViewerUri(null)}>
            <Ionicons name="close" size={28} color={colors.white} />
          </Pressable>
          {viewerUri ? <Image source={{ uri: viewerUri }} style={styles.viewerImage} resizeMode="contain" /> : <ActivityIndicator color={colors.white} />}
        </View>
      </Modal>
    </View>
  );
}
