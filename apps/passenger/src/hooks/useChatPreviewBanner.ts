import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getSupabaseClient } from '@trisakay/services';

export interface ChatPreviewMessage {
  senderId: string;
  kind: 'text' | 'quick_reply' | 'image' | 'system';
  body: string | null;
  imagePath: string | null;
  createdAt: string;
}

interface RideMessageInsertRow {
  sender_id: string;
  kind: string;
  body: string | null;
  image_path: string | null;
  created_at: string;
}

/**
 * Part B §B7 / README §4.4 — the in-app message preview banner on
 * `booking/trip`, live only while this screen is focused. Deliberately not
 * built on `useChatStore` (single-thread: one `connect(rideRequestId, ...)`
 * at a time, owned by `booking/chat.tsx`) — its own `postgres_changes`
 * INSERT listener on this one ride, unsubscribed on blur.
 */
export function useChatPreviewBanner(rideRequestId: string | null, selfUserId: string | undefined) {
  const [preview, setPreview] = useState<ChatPreviewMessage | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!selfUserId || !rideRequestId) return;
      const client = getSupabaseClient();
      const channel = client
        .channel(`chat_preview_${rideRequestId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'ride_messages', filter: `ride_request_id=eq.${rideRequestId}` },
          (payload: { new: RideMessageInsertRow }) => {
            const row = payload.new;
            if (row.sender_id === selfUserId) return;
            setPreview({
              senderId: row.sender_id,
              kind: row.kind as ChatPreviewMessage['kind'],
              body: row.body,
              imagePath: row.image_path,
              createdAt: row.created_at,
            });
          }
        )
        .subscribe();

      return () => {
        client.removeChannel(channel);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rideRequestId, selfUserId])
  );

  useEffect(() => {
    if (!preview) return;
    const timer = setTimeout(() => setPreview(null), 4000);
    return () => clearTimeout(timer);
  }, [preview]);

  return { preview, dismiss: () => setPreview(null) };
}
