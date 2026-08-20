import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export type ComplaintDbStatus = Database['public']['Enums']['complaint_status'];
export type ComplaintCategory = Database['public']['Enums']['complaint_category'];

async function getSignedInUserId(): Promise<string | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.user.id ?? null;
}

export interface ComplaintAttachmentInput {
  /** Raw file bytes, not a URI — see submitDriverDocuments for why: callers
   *  read the file themselves (expo-file-system's `File`), not `fetch(uri)`. */
  data: ArrayBuffer | Uint8Array;
  contentType?: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface SubmitComplaintInput {
  subject: string;
  message: string;
  /** Left for the column's own default ('other') when omitted. */
  category?: ComplaintCategory;
  /** The ride this complaint is about, if any — `complaints.ride_request_id` is nullable. */
  rideRequestId?: string;
  /** Optional evidence photos, uploaded to the private `complaint-evidence` bucket. */
  attachments?: ComplaintAttachmentInput[];
}

export interface SubmitComplaintResult {
  error: string | null;
  /**
   * Set when the complaint itself was filed successfully but one or more
   * attachments failed to upload/record — the complaint is not rolled back
   * for this (there's no delete RLS on `complaints` to do so with), so this
   * is surfaced separately rather than folded into `error`.
   */
  attachmentError: string | null;
}

const ATTACHMENT_EXTENSION_BY_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

async function uploadComplaintAttachments(
  complaintId: string,
  userId: string,
  attachments: ComplaintAttachmentInput[]
): Promise<{ error: string | null }> {
  const uploaded: string[] = [];

  for (let i = 0; i < attachments.length; i++) {
    const contentType = attachments[i].contentType ?? 'image/jpeg';
    const path = `${complaintId}/${i}-${Date.now()}.${ATTACHMENT_EXTENSION_BY_TYPE[contentType]}`;
    const { error } = await getSupabaseClient()
      .storage.from('complaint-evidence')
      .upload(path, attachments[i].data, { contentType });

    if (error) {
      if (uploaded.length > 0) {
        await getSupabaseClient().storage.from('complaint-evidence').remove(uploaded).catch(() => {});
      }
      return { error: error.message };
    }
    uploaded.push(path);
  }

  const { error: insertError } = await getSupabaseClient()
    .from('complaint_attachments')
    .insert(uploaded.map((storage_path) => ({ complaint_id: complaintId, storage_path, uploaded_by: userId })));

  if (insertError) {
    await getSupabaseClient().storage.from('complaint-evidence').remove(uploaded).catch(() => {});
    return { error: insertError.message };
  }

  return { error: null };
}

/**
 * Files a complaint as the signed-in user (`submitted_by = auth.uid()`,
 * enforced by the `complaints_submit` RLS policy). If `attachments` are
 * given, they're uploaded and recorded after the complaint row exists (the
 * `complaint_attachments` insert RLS requires a real `complaint_id` already
 * owned by the caller) — an attachment failure is reported via
 * `attachmentError` without undoing the complaint itself.
 */
export async function submitComplaint({
  subject,
  message,
  category,
  rideRequestId,
  attachments,
}: SubmitComplaintInput): Promise<SubmitComplaintResult> {
  const userId = await getSignedInUserId();
  if (!userId) return { error: 'Not signed in', attachmentError: null };

  const { data, error } = await getSupabaseClient()
    .from('complaints')
    .insert({
      submitted_by: userId,
      subject,
      message,
      ...(category ? { category } : {}),
      ...(rideRequestId ? { ride_request_id: rideRequestId } : {}),
    })
    .select('id')
    .single();

  if (error) return { error: error.message, attachmentError: null };

  if (attachments && attachments.length > 0) {
    const { error: attachmentError } = await uploadComplaintAttachments(data.id, userId, attachments);
    if (attachmentError) return { error: null, attachmentError };
  }

  return { error: null, attachmentError: null };
}

export interface MyComplaintRow {
  id: string;
  subject: string;
  status: ComplaintDbStatus;
}

export interface ListMyComplaintsResult {
  data: MyComplaintRow[];
  error: string | null;
}

/** The signed-in user's own submitted complaints, newest first. */
export async function listMyComplaints(): Promise<ListMyComplaintsResult> {
  const userId = await getSignedInUserId();
  if (!userId) return { data: [], error: 'Not signed in' };

  const { data, error } = await getSupabaseClient()
    .from('complaints')
    .select('id, subject, status')
    .eq('submitted_by', userId)
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}
