import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';
import { submitComplaint } from '../complaints/index.ts';

export type RideMessageKind = 'text' | 'quick_reply' | 'image' | 'system';

export interface RideMessage {
  id: string;
  rideRequestId: string;
  senderId: string;
  kind: RideMessageKind;
  body: string | null;
  imagePath: string | null;
  containsMaskedPhone: boolean;
  createdAt: string;
  readAt: string | null;
}

async function getSignedInUserId(): Promise<string | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.user.id ?? null;
}

type RideMessageRow = Database['public']['Tables']['ride_messages']['Row'];

function mapRow(row: RideMessageRow): RideMessage {
  return {
    id: row.id,
    rideRequestId: row.ride_request_id,
    senderId: row.sender_id,
    kind: row.kind as RideMessageKind,
    body: row.body,
    imagePath: row.image_path,
    containsMaskedPhone: row.contains_masked_phone,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export interface ListMessagesResult {
  data: RideMessage[];
  error: string | null;
}

/** Full history for a ride's thread, oldest first — `ride_messages_read` RLS scopes this to the two real parties on the row. */
export async function listMessages(rideRequestId: string): Promise<ListMessagesResult> {
  const { data, error } = await getSupabaseClient()
    .from('ride_messages')
    .select('*')
    .eq('ride_request_id', rideRequestId)
    .order('created_at', { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map(mapRow), error: null };
}

export interface SendMessageResult {
  data: RideMessage | null;
  error: string | null;
}

/** `sender_id`/`created_at` are forced server-side by `enforce_ride_message_insert_fields` — never trust what's echoed back for those beyond display. Length-capped and trimmed client-side; the server has no length check of its own, so this is the only guard. */
const MAX_MESSAGE_LENGTH = 1000;

export async function sendTextMessage(rideRequestId: string, body: string): Promise<SendMessageResult> {
  const trimmed = body.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!trimmed) return { data: null, error: 'Message is empty' };

  const userId = await getSignedInUserId();
  if (!userId) return { data: null, error: 'Not signed in' };

  // sender_id is required by the generated Insert type (the column has no
  // DB-level default) but is overwritten unconditionally by
  // enforce_ride_message_insert_fields regardless of what's sent here —
  // this is honest self-documentation, not a real trust boundary.
  const { data, error } = await getSupabaseClient()
    .from('ride_messages')
    .insert({ ride_request_id: rideRequestId, sender_id: userId, kind: 'text', body: trimmed })
    .select('*')
    .single();

  if (error) return { data: null, error: error.message };
  return { data: mapRow(data), error: null };
}

/** `code` is a fixed quick-reply key (e.g. `'im_here'`), not free text — both apps render it through their own i18n so it reads correctly in either party's language regardless of who sent it. */
export async function sendQuickReply(rideRequestId: string, code: string): Promise<SendMessageResult> {
  const userId = await getSignedInUserId();
  if (!userId) return { data: null, error: 'Not signed in' };

  const { data, error } = await getSupabaseClient()
    .from('ride_messages')
    .insert({ ride_request_id: rideRequestId, sender_id: userId, kind: 'quick_reply', body: code })
    .select('*')
    .single();

  if (error) return { data: null, error: error.message };
  return { data: mapRow(data), error: null };
}

export interface SendPhotoMessageInput {
  rideRequestId: string;
  /** Already re-encoded/EXIF-stripped by the caller (expo-image-manipulator) — this module doesn't process image bytes. */
  data: ArrayBuffer | Uint8Array;
  contentType?: 'image/jpeg' | 'image/png' | 'image/webp';
}

const IMAGE_EXTENSION_BY_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

/** Uploads to the private `ride-chat` bucket (folder-keyed by `rideRequestId`, matching `ride_chat_insert`'s RLS), then inserts the `kind:'image'` row. If the insert fails, the just-uploaded file is removed so it doesn't linger as an orphan no message ever points to. */
export async function sendPhotoMessage({ rideRequestId, data, contentType = 'image/jpeg' }: SendPhotoMessageInput): Promise<SendMessageResult> {
  const userId = await getSignedInUserId();
  if (!userId) return { data: null, error: 'Not signed in' };

  const path = `${rideRequestId}/${Date.now()}.${IMAGE_EXTENSION_BY_TYPE[contentType]}`;
  const { error: uploadError } = await getSupabaseClient().storage.from('ride-chat').upload(path, data, { contentType });
  if (uploadError) return { data: null, error: uploadError.message };

  const { data: row, error } = await getSupabaseClient()
    .from('ride_messages')
    .insert({ ride_request_id: rideRequestId, sender_id: userId, kind: 'image', image_path: path })
    .select('*')
    .single();

  if (error) {
    await getSupabaseClient().storage.from('ride-chat').remove([path]).catch(() => {});
    return { data: null, error: error.message };
  }
  return { data: mapRow(row), error: null };
}

export interface MarkMessagesReadResult {
  error: string | null;
}

/** Marks every unread message in this thread read. `ride_messages_update` RLS already restricts this to rows the caller didn't send, so no `sender_id` filter is needed here — a row the caller sent is simply left untouched by Postgres rather than erroring. */
export async function markMessagesRead(rideRequestId: string): Promise<MarkMessagesReadResult> {
  const { error } = await getSupabaseClient()
    .from('ride_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('ride_request_id', rideRequestId)
    .is('read_at', null);

  return { error: error?.message ?? null };
}

/**
 * Live delivery for a ride's thread — models `subscribeToTransferInvites`
 * (packages/services/src/transfers/index.ts): refetch the full thread once
 * on SUBSCRIBED (postgres_changes only delivers future events, so this
 * covers anything sent before the channel joined or during a reconnect),
 * then again on every INSERT/UPDATE (an UPDATE covers the other party's
 * read receipt landing).
 */
export function subscribeToRideMessages(
  rideRequestId: string,
  onData: (messages: RideMessage[]) => void,
  onError?: (message: string) => void
): () => void {
  const client = getSupabaseClient();
  let cancelled = false;

  async function refetch() {
    const { data, error } = await listMessages(rideRequestId);
    if (cancelled) return;
    if (error) {
      onError?.(error);
      return;
    }
    onData(data);
  }

  const channel = client
    .channel(`ride_messages_${rideRequestId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'ride_messages', filter: `ride_request_id=eq.${rideRequestId}` },
      () => {
        void refetch();
      }
    )
    .subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        void refetch();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (!cancelled) onError?.('Lost connection to the chat. Please check your connection.');
      }
    });

  return () => {
    cancelled = true;
    client.removeChannel(channel);
  };
}

/**
 * "Typing…" — a Realtime broadcast channel, not `postgres_changes`: it's
 * never written to `ride_messages` (per the spec, typing state is never
 * persisted). Both parties join the same named channel and broadcast a
 * `typing` event at each other; the receiver clears its own "is typing"
 * flag on a short client-side timeout (not built here — that's a UI concern).
 */
export function subscribeToTyping(rideRequestId: string, onTyping: (senderId: string) => void): () => void {
  const client = getSupabaseClient();
  const channel = client
    .channel(`ride_typing_${rideRequestId}`)
    .on('broadcast', { event: 'typing' }, (payload: { payload: { senderId: string } }) => {
      onTyping(payload.payload.senderId);
    })
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

export async function sendTypingBroadcast(rideRequestId: string, senderId: string): Promise<void> {
  const client = getSupabaseClient();
  const channel = client.channel(`ride_typing_${rideRequestId}`);
  await channel.send({ type: 'broadcast', event: 'typing', payload: { senderId } });
}

export interface ReportMessageInput {
  rideRequestId: string;
  messageBody: string | null;
}

export interface ReportMessageResult {
  error: string | null;
  id: string | null;
}

/**
 * "Report message" (L11) — reuses the existing complaints pipeline rather
 * than building separate moderation machinery. Files a `conduct` complaint
 * prefilled with the ride and the reported message's text, exactly the way
 * a driver/passenger would file any other complaint from this ride.
 */
export async function reportMessage({ rideRequestId, messageBody }: ReportMessageInput): Promise<ReportMessageResult> {
  const userId = await getSignedInUserId();
  if (!userId) return { error: 'Not signed in', id: null };

  const result = await submitComplaint({
    subject: 'Reported chat message',
    message: messageBody ? `Reported message: "${messageBody}"` : 'Reported a chat message (photo).',
    category: 'conduct',
    rideRequestId,
  });

  return { error: result.error, id: result.id };
}
