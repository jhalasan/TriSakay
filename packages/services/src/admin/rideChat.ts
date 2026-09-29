import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';
import type { RideMessage, RideMessageKind } from '../chat/index.ts';

type RideMessageRow = Database['public']['Tables']['ride_messages']['Row'];

function mapMessageRow(row: RideMessageRow): RideMessage {
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

/** RideMessage plus the sender's name/role, resolved for display — the RPC itself returns bare ride_messages rows with no join. */
export interface AdminRideMessage extends RideMessage {
  senderName: string | null;
  senderRole: string | null;
}

export interface ViewRideMessagesResult {
  data: AdminRideMessage[];
  error: string | null;
}

/**
 * S1 (UAT_PANELIST_REVIEW_ADRALES.md) — the PSO case-view slice that C1's own
 * migration deferred. Calls admin_view_ride_messages(), a SECURITY DEFINER
 * RPC that is the only way a PSO account can read a ride's chat thread
 * (ride_messages' own RLS is strictly two-party). The RPC itself rejects a
 * non-PSO caller, a blank reason, or a ride with no linked complaint/
 * emergency alert, and atomically writes an audit row before returning any
 * messages — so a caller here either gets the full thread with a logged
 * reason, or nothing at all.
 *
 * The follow-up `users` lookup (same one-hop pattern as listAccountActions)
 * is safe for a PSO caller specifically: `users_select_self`'s RLS is
 * `id = auth.uid() OR is_pso()`, so this only ever runs for a role the RPC
 * above already required.
 */
export async function adminViewRideMessages(rideRequestId: string, reason: string): Promise<ViewRideMessagesResult> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('admin_view_ride_messages', {
    p_ride_request_id: rideRequestId,
    p_reason: reason,
  });

  if (error) return { data: [], error: error.message };

  const messages = (data ?? []).map(mapMessageRow);
  const senderIds = [...new Set(messages.map((m) => m.senderId))];
  const names = new Map<string, string>();
  const roles = new Map<string, string>();
  if (senderIds.length > 0) {
    const { data: userRows } = await client.from('users').select('id, full_name, role').in('id', senderIds);
    for (const row of userRows ?? []) {
      names.set(row.id, row.full_name!);
      roles.set(row.id, row.role);
    }
  }

  return {
    data: messages.map((m) => ({ ...m, senderName: names.get(m.senderId) ?? null, senderRole: roles.get(m.senderId) ?? null })),
    error: null,
  };
}

export interface RideMessageViewLogRow {
  id: string;
  rideRequestId: string;
  complaintId: string | null;
  emergencyAlertId: string | null;
  viewedBy: string;
  viewedByName: string | null;
  reason: string;
  createdAt: string;
}

export interface ListRideMessageViewLogResult {
  data: RideMessageViewLogRow[];
  error: string | null;
  truncated: boolean;
}

const RIDE_MESSAGE_VIEW_LOG_ROW_CAP = 2000;

/**
 * Reads ride_message_view_log — the audit trail admin_view_ride_messages()
 * writes on every case-view read. RLS (`ride_message_view_log_read_pso`)
 * lets any signed-in PSO read every row, same transparency convention as
 * listAccountActions(). This closes L16 ("PSO case access with a junk
 * reason") on the reporting side: every access is here, with its reason,
 * regardless of role.
 */
export async function listRideMessageViewLog(sinceIso: string | null = null): Promise<ListRideMessageViewLogResult> {
  const client = getSupabaseClient();
  let query = client
    .from('ride_message_view_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(RIDE_MESSAGE_VIEW_LOG_ROW_CAP);
  if (sinceIso) query = query.gte('created_at', sinceIso);
  const { data, error } = await query;

  if (error) return { data: [], error: error.message, truncated: false };

  const viewerIds = [...new Set((data ?? []).map((row) => row.viewed_by))];
  const names = new Map<string, string>();
  if (viewerIds.length > 0) {
    const { data: userRows } = await client.from('users').select('id, full_name').in('id', viewerIds);
    for (const row of userRows ?? []) names.set(row.id, row.full_name!);
  }

  const rows: RideMessageViewLogRow[] = (data ?? []).map((row) => ({
    id: row.id,
    rideRequestId: row.ride_request_id,
    complaintId: row.complaint_id,
    emergencyAlertId: row.emergency_alert_id,
    viewedBy: row.viewed_by,
    viewedByName: names.get(row.viewed_by) ?? null,
    reason: row.reason,
    createdAt: row.created_at,
  }));

  return { data: rows, error: null, truncated: (data ?? []).length >= RIDE_MESSAGE_VIEW_LOG_ROW_CAP };
}
