import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export type DriverDocumentType = Database['public']['Enums']['document_type'];

export interface DriverDocumentInput {
  type: DriverDocumentType;
  /**
   * Raw file bytes, not a URI — see uploadAvatar in ../storage/index.ts for
   * why: `fetch(uri).arrayBuffer()` on a local picker URI is unreliable on
   * React Native (silently empty on some Android setups). Callers read the
   * file themselves (expo-file-system's `File`), same as the avatar flow.
   */
  data: ArrayBuffer | Uint8Array;
  contentType?: 'image/jpeg' | 'image/png' | 'image/webp';
}

/** Same rule the `driver-docs` storage bucket enforces: JPG, PNG or WebP, 5 MB at most. */
export const DRIVER_DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
export const DRIVER_DOCUMENT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type DriverDocumentFileProblem = 'too_large' | 'wrong_type';

/**
 * Checks a picked file before upload so the driver gets a clear message instead
 * of a storage error. An unknown size or type returns null and is left to the
 * bucket's own rules.
 */
export function validateDriverDocumentFile(file: { sizeBytes?: number | null; mimeType?: string | null }): DriverDocumentFileProblem | null {
  if (file.mimeType && !(DRIVER_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.mimeType)) return 'wrong_type';
  if (typeof file.sizeBytes === 'number' && file.sizeBytes > DRIVER_DOCUMENT_MAX_BYTES) return 'too_large';
  return null;
}

export interface SubmitDriverDocumentsResult {
  error: string | null;
}

const EXTENSION_BY_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

async function uploadDriverDocument(userId: string, doc: DriverDocumentInput) {
  const contentType = doc.contentType ?? 'image/jpeg';
  const path = `${userId}/${doc.type}-${Date.now()}.${EXTENSION_BY_TYPE[contentType]}`;
  const { error } = await getSupabaseClient().storage.from('driver-docs').upload(path, doc.data, { contentType });
  return { path, error };
}

/**
 * Uploads each document to the private `driver-docs` bucket under the
 * driver's own folder, then calls the `submit_driver_documents` RPC to
 * record them all in one transaction. Requires an active session for
 * `userId` (RLS scopes the bucket to the owning driver, same as discount ID
 * photos on the passenger side).
 *
 * The RPC (not a plain insert) exists because vehicle documents need a
 * `tricycle_id` the driver doesn't have yet — there's no `tricycles` row
 * before this call. The RPC creates one from `plateNo` (the only vehicle
 * field the registration form actually collects; MTOP/cluster stay blank
 * for PSO to transcribe during review), attaches every document to it, and
 * flips both `driver_profiles.verification_status` and the new tricycle's
 * `verification_status` from `unsubmitted` to `pending` — the transition
 * that makes the case show up for review. Nothing else in the system does
 * this: RLS blocks a driver from setting their own `verification_status`
 * directly (`driver_update_self`'s `with check` requires it stay
 * unchanged), and there is no trigger for it, so without this single
 * atomic call a submitted driver would sit as `unsubmitted` forever.
 */
export async function submitDriverDocuments(
  userId: string,
  plateNo: string,
  documents: DriverDocumentInput[]
): Promise<SubmitDriverDocumentsResult> {
  const uploaded: { docType: DriverDocumentType; path: string }[] = [];

  try {
    for (const doc of documents) {
      const { path, error } = await uploadDriverDocument(userId, doc);
      if (error) {
        if (uploaded.length > 0) {
          await getSupabaseClient()
            .storage.from('driver-docs')
            .remove(uploaded.map((u) => u.path))
            .catch(() => {});
        }
        return { error: error.message };
      }
      uploaded.push({ docType: doc.type, path });
    }

    const { error: rpcError } = await getSupabaseClient().rpc('submit_driver_documents', {
      p_plate_no: plateNo,
      p_documents: uploaded.map((u) => ({ doc_type: u.docType, storage_path: u.path })),
    });

    if (rpcError) {
      await getSupabaseClient()
        .storage.from('driver-docs')
        .remove(uploaded.map((u) => u.path))
        .catch(() => {});
      return {
        error:
          rpcError.code === '23505'
            ? 'That plate number is already registered to another driver. Please double-check it and try again.'
            : rpcError.message,
      };
    }

    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Document submission failed' };
  }
}

export interface ResubmitDriverDocumentsResult {
  error: string | null;
  /** How many documents are still rejected after this call; 0 means the application went back to review. */
  remaining: number | null;
}

/**
 * The driver replaces only the documents a reviewer rejected. Uploads each file
 * to the private `driver-docs` bucket, then `resubmit_driver_documents` swaps
 * them in and, once none is left rejected, puts the application back to
 * pending. Uploaded files are removed again if the RPC refuses them.
 */
export async function resubmitDriverDocuments(userId: string, documents: DriverDocumentInput[]): Promise<ResubmitDriverDocumentsResult> {
  const uploaded: { docType: DriverDocumentType; path: string }[] = [];
  const cleanup = () =>
    getSupabaseClient()
      .storage.from('driver-docs')
      .remove(uploaded.map((u) => u.path))
      .catch(() => {});

  try {
    for (const doc of documents) {
      const { path, error } = await uploadDriverDocument(userId, doc);
      if (error) {
        if (uploaded.length > 0) await cleanup();
        return { error: error.message, remaining: null };
      }
      uploaded.push({ docType: doc.type, path });
    }

    const { data, error: rpcError } = await getSupabaseClient().rpc('resubmit_driver_documents', {
      p_documents: uploaded.map((u) => ({ doc_type: u.docType, storage_path: u.path })),
    });

    if (rpcError) {
      await cleanup();
      return { error: rpcError.message, remaining: null };
    }

    return { error: null, remaining: data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Document submission failed', remaining: null };
  }
}

export interface OwnDriverDocumentRow {
  id: string;
  docType: DriverDocumentType;
  status: Database['public']['Enums']['verification_status'];
  expiryDate: string | null;
  /** The reviewer's reason, filled in when this document was rejected. */
  remarks: string | null;
}

export interface ListOwnDriverDocumentsResult {
  data: OwnDriverDocumentRow[];
  error: string | null;
}

/**
 * UAT D13 — reads the signed-in driver's own driver_documents rows so they
 * can review/set each document's expiry date. `documents_owner_rw` RLS
 * already grants `driver_id = auth.uid()` full read access, same as it does
 * for the write path below.
 */
export async function listOwnDriverDocuments(): Promise<ListOwnDriverDocumentsResult> {
  const client = getSupabaseClient();
  const { data: session } = await client.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return { data: [], error: 'Not signed in' };

  const { data, error } = await client
    .from('driver_documents')
    .select('id, doc_type, status, expiry_date, remarks')
    .eq('driver_id', userId);

  if (error) return { data: [], error: error.message };

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      docType: row.doc_type,
      status: row.status,
      expiryDate: row.expiry_date,
      remarks: row.remarks,
    })),
    error: null,
  };
}

export interface UpdateDriverDocumentExpiryResult {
  error: string | null;
}

/**
 * UAT D13 — self-reported expiry date, written directly (not through
 * submit_driver_documents, an untracked dashboard-only RPC not safe to
 * extend blind). `documents_owner_rw`'s WITH CHECK already permits
 * `driver_id = auth.uid()`, so a plain update needs no new RLS.
 *
 * `expiry_notified_at` is reset to null on every change — it marks whether
 * the notify-expiring-documents Edge Function has already sent a push for
 * the CURRENT expiry_date, so a driver who updates the date (e.g. renews
 * the document) needs to become eligible for a fresh notification again.
 */
export async function updateDriverDocumentExpiry(documentId: string, expiryDate: string | null): Promise<UpdateDriverDocumentExpiryResult> {
  const client = getSupabaseClient();
  const { data: session } = await client.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return { error: 'Not signed in' };

  const { error } = await client
    .from('driver_documents')
    .update({ expiry_date: expiryDate, expiry_notified_at: null })
    .eq('id', documentId)
    .eq('driver_id', userId);

  return { error: error?.message ?? null };
}
