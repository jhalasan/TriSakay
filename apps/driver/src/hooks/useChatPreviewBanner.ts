import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getSupabaseClient } from '@trisakay/services';

export interface ChatPreviewMessage {
  rideRequestId: string;
  senderId: string;
  kind: 'text' | 'quick_reply' | 'image' | 'system';
  body: string | null;
  imagePath: string | null;
  createdAt: string;
}

interface RideMessageInsertRow {
  ride_request_id: string;
  sender_id: string;
  kind: string;
  body: string | null;
  image_path: string | null;
  created_at: string;
}

/**
 * README §4.4 — the in-app message preview banner on `trip/active`, live
 * only while this screen is focused. Deliberately not built on
 * `useChatStore` (single-thread: one `connect(rideRequestId, ...)` at a
 * time) — this listens across every active passenger's thread at once with
 * its own `postgres_changes` INSERT filter, and unsubscribes on blur.
 */
export function useChatPreviewBanner(rideRequestIds: string[], selfUserId: string | undefined) {
  const [preview, setPreview] = useState<ChatPreviewMessage | null>(null);
  const key = [...rideRequestIds].sort().join(',');

  useFocusEffect(
    useCallback(() => {
      if (!selfUserId || !key) return;
      const client = getSupabaseClient();
      const channel = client
        .channel(`chat_preview_${key}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'ride_messages', filter: `ride_request_id=in.(${key})` },
          (payload: { new: RideMessageInsertRow }) => {
            const row = payload.new;
            if (row.sender_id === selfUserId) return;
            setPreview({
              rideRequestId: row.ride_request_id,
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
    }, [key, selfUserId])
  );

  useEffect(() => {
    if (!preview) return;
    const timer = setTimeout(() => setPreview(null), 4000);
    return () => clearTimeout(timer);
  }, [preview]);

  return { preview, dismiss: () => setPreview(null) };
}
