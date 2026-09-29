import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  getSignedDocumentUrl,
  reportMessage,
  sendPhotoMessage,
  sendQuickReply,
  sendTextMessage,
  sendTypingBroadcast,
  subscribeToDriverLocation,
  subscribeToRideRequestStatus,
  type DriverLocation,
  type RideMessage,
} from '@trisakay/services';
import { ASSUMED_TRICYCLE_SPEED_KMH, buildChatRows, estimateEtaMinutes, haversineKm, splitMaskedPhoneBody, type ChatRow, type ChatSystemKind } from '@trisakay/shared';
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
import { useTranslation } from '../../src/hooks/useTranslation';
import { useChatPrivacyTip } from '../../src/hooks/useChatPrivacyTip';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useBookingStore } from '../../src/store/useBookingStore';
import { useChatStore } from '../../src/store/useChatStore';
import { useSettingsStore } from '../../src/store/useSettingsStore';
import { preparePhotoForChat } from '../../src/utils/preparePhotoForChat';
import { interpolate } from '../../src/utils/interpolate';
import { styles } from '../../src/styles/booking/chat.styles';

const QUICK_REPLY_CODES = ['where_are_you', 'at_pickup_point', 'please_wait'] as const;

type RideChatStatus = 'assigned' | 'ongoing' | 'completed' | 'cancelled' | null;

interface RideStatusInfo {
  status: RideChatStatus;
  arrivedAt: string | null;
  assignedAt: string | null;
  endedAt: string | null;
}

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

export default function PassengerChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const language = useSettingsStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const driver = useBookingStore((state) => state.driver);
  const pickup = useBookingStore((state) => state.pickup);
  const rideRequestId = useBookingStore((state) => state.rideRequestId);
  const messages = useChatStore((state) => state.messages);
  const loading = useChatStore((state) => state.loading);
  const chatError = useChatStore((state) => state.error);
  const otherPartyTyping = useChatStore((state) => state.otherPartyTyping);
  const connect = useChatStore((state) => state.connect);
  const disconnect = useChatStore((state) => state.disconnect);
  const tip = useChatPrivacyTip();

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

  const [rideInfo, setRideInfo] = useState<RideStatusInfo>({ status: null, arrivedAt: null, assignedAt: null, endedAt: null });
  const [driverChangedAt, setDriverChangedAt] = useState<string | null>(null);
  const lastTripIdRef = useRef<string | null | undefined>(undefined);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);

  useEffect(() => {
    if (!rideRequestId || !user) return;
    connect(rideRequestId, user.id);
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideRequestId, user?.id]);

  // Mirrors booking/trip.tsx's own ride-status subscription — this screen
  // needs the same stage/arrived/transfer signals for its header and
  // read-only state, but trip.tsx keeps that as local state rather than in
  // a shared store, so this is its own independent subscription rather
  // than a bigger store-lifting change.
  useEffect(() => {
    if (!rideRequestId) return;
    let cancelled = false;
    lastTripIdRef.current = undefined;
    const unsubscribe = subscribeToRideRequestStatus(rideRequestId, (row) => {
      if (cancelled) return;
      if (row.status === 'assigned' || row.status === 'ongoing') {
        if (lastTripIdRef.current !== undefined && lastTripIdRef.current !== row.trip_id) {
          setDriverChangedAt(new Date().toISOString());
        }
        lastTripIdRef.current = row.trip_id;
      }
      setRideInfo({
        status: row.status === 'pending' ? null : (row.status as RideChatStatus),
        arrivedAt: row.arrived_at,
        assignedAt: row.assigned_at,
        endedAt: row.completed_at ?? row.cancelled_at,
      });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [rideRequestId]);

  useEffect(() => {
    if (rideInfo.status !== 'assigned' || rideInfo.arrivedAt || !driver?.id) {
      setDriverLocation(null);
      return;
    }
    const unsubscribe = subscribeToDriverLocation(driver.id, setDriverLocation);
    return unsubscribe;
  }, [rideInfo.status, rideInfo.arrivedAt, driver?.id]);

  const etaMinutes =
    driverLocation && pickup
      ? estimateEtaMinutes(haversineKm(driverLocation.lat, driverLocation.lng, pickup.latitude, pickup.longitude), ASSUMED_TRICYCLE_SPEED_KMH)
      : null;

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

  const isReadOnly = rideInfo.status === 'completed' || rideInfo.status === 'cancelled';

  const rows = useMemo(
    () =>
      buildChatRows(
        messages,
        user?.id ?? '',
        {
          acceptedAt: rideInfo.assignedAt,
          driverChangedAt,
          arrivedAt: rideInfo.arrivedAt,
          endedAt: rideInfo.endedAt,
          endedStatus: rideInfo.status === 'completed' ? 'completed' : rideInfo.status === 'cancelled' ? 'cancelled' : null,
        },
        { locale: language === 'fil' ? 'fil-PH' : 'en-PH', otherPartyTyping }
      ),
    [messages, user?.id, rideInfo, driverChangedAt, otherPartyTyping, language]
  );

  useEffect(() => {
    if (rows.length > 0) listRef.current?.scrollToEnd({ animated: true });
  }, [rows.length]);

  function quickReplyLabel(code: string): string {
    return (t.chat.quickReplies as Record<string, string>)[code] ?? code;
  }

  function messageText(message: RideMessage): string | undefined {
    if (message.kind === 'text') return message.body ?? undefined;
    if (message.kind === 'quick_reply') return quickReplyLabel(message.body ?? '');
    return undefined;
  }

  function headerStatus(): { dot: ChatHeaderDotTone; text: string } {
    if (rideInfo.status === 'completed') {
      return { dot: 'neutral', text: interpolate(t.chat.headerCompleted, { time: rideInfo.endedAt ? formatTime(rideInfo.endedAt) : '' }) };
    }
    if (rideInfo.status === 'cancelled') {
      return { dot: 'neutral', text: interpolate(t.chat.headerCancelled, { time: rideInfo.endedAt ? formatTime(rideInfo.endedAt) : '' }) };
    }
    if (rideInfo.status === 'ongoing') return { dot: 'blue', text: t.chat.headerRiding };
    if (rideInfo.status === 'assigned') {
      if (rideInfo.arrivedAt) return { dot: 'green', text: t.chat.headerWaiting };
      return { dot: 'green', text: etaMinutes !== null ? interpolate(t.chat.headerArriving, { n: etaMinutes }) : t.chat.headerOnTheWay };
    }
    return { dot: 'neutral', text: t.chat.headerOnTheWay };
  }

  function systemText(kind: ChatSystemKind, at: string, body?: string): string {
    const time = formatTime(at);
    const name = driver?.name ?? '';
    switch (kind) {
      case 'accepted':
        return interpolate(t.chat.sys.accepted, { name, time });
      case 'moved':
        return interpolate(t.chat.sys.moved, { name, time });
      case 'arrived':
        return interpolate(t.chat.sys.arrived, { name, time });
      case 'completed':
        return t.chat.sys.completed;
      case 'cancelled':
        return t.chat.sys.cancelled;
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
        setSendError(t.chat.sendFailed);
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
        setSendError(t.chat.sendFailed);
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
      if (error) setSendError(t.chat.photoUploadFailed);
      else lastFailedRef.current = null;
    } catch {
      setSendError(t.chat.photoUploadFailed);
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
    setReportToast(error ? t.chat.reportFailed : t.chat.reportDone);
    setTimeout(() => setReportToast(null), 3000);
  }

  function renderRow({ item }: { item: ChatRow<RideMessage> }) {
    if (item.type === 'day') {
      return (
        <View style={styles.daySeparatorRow}>
          <Text style={styles.daySeparator}>{item.day === 'today' ? t.chat.today : item.day === 'yesterday' ? t.chat.yesterday : item.dateLabel}</Text>
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
          maskedTokenText={t.chat.numberHidden}
          maskedTokenLabel={t.chat.maskedNotice}
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
                <Text style={styles.seenText}>{t.chat.seen}</Text>
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

  return (
    <View style={styles.container}>
      <ChatHeader
        name={driver?.name || t.trip.messageDriver}
        avatarUrl={driver?.avatarUrl}
        statusDot={status.dot}
        statusText={status.text}
        onBack={() => router.back()}
        plate={!isReadOnly && driver?.plateNumber ? driver.plateNumber : null}
        plateLabel={t.chat.plate}
        topInset={insets.top}
      />

      {tip.visible && !isReadOnly && !showEmpty && (
        <View style={styles.privacyTip}>
          <Ionicons name="shield-checkmark" size={13} color={colors.accentBlue} />
          <Text style={styles.privacyTipText}>{t.chat.tip}</Text>
          <Pressable accessibilityRole="button" hitSlop={16} onPress={tip.dismiss}>
            <Ionicons name="close" size={12} color={colors.inkSoft} />
          </Pressable>
        </View>
      )}

      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {chatError && <ChatErrorBar message={chatError} onRetry={handleReconnect} retryLabel={t.chat.retry} />}

        {showEmpty ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconTile}>
              <Ionicons name="chatbubble-ellipses-outline" size={26} color={colors.accentBlue} />
            </View>
            <Text style={styles.emptyTitle}>{interpolate(t.chat.emptyTitleNamed, { name: driver?.name ? firstNameOf(driver.name) : '' })}</Text>
            <Text style={styles.emptyBody}>{t.chat.emptyBodyPassenger}</Text>
            <View style={styles.emptyNoteRow}>
              <Ionicons name="shield-checkmark" size={12} color={colors.accentGreen} />
              <Text style={styles.emptyNoteText}>{t.chat.emptyNote}</Text>
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

        {sendError && <ChatErrorBar message={sendError} onRetry={handleRetry} retryLabel={t.chat.retry} />}
        {rateLimited && <ChatErrorBar message={t.chat.rateLimited} />}

        {isReadOnly ? (
          <ChatReadOnlyBar
            message={t.chat.readOnly}
            reportLabel={t.chat.reportRide}
            onReport={() => router.push(`/complaints/new?rideRequestId=${rideRequestId}`)}
            bottomInset={insets.bottom}
          />
        ) : (
          <>
            <QuickReplyRow options={QUICK_REPLY_CODES.map((code) => ({ code, label: quickReplyLabel(code) }))} onSelect={handleQuickReply} disabled={sending} size="md" />
            <ChatComposer
              value={draft}
              onChangeText={handleChangeText}
              onSend={handleSend}
              onAttachPhoto={handleAttachPhoto}
              sending={sending}
              placeholder={driver?.name ? interpolate(t.chat.inputPlaceholderNamed, { name: firstNameOf(driver.name) }) : t.chat.inputPlaceholder}
            />
          </>
        )}
      </KeyboardAvoidingView>

      <ChatReportSheet
        visible={!!reportTarget}
        title={t.chat.reportTitle}
        fromLabel={reportTarget ? interpolate(t.chat.reportFrom, { name: driver?.name ?? '', time: formatTime(reportTarget.createdAt) }) : ''}
        body={t.chat.reportBody}
        reportLabel={t.chat.reportMessage}
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
