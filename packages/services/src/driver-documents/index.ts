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
