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
 * driver's own folder, then inserts one `driver_documents` row per file
 * (`status` defaults to `pending` — a PSO reviewer approves/rejects each
 * individually). Requires an active session for `userId` (RLS scopes both
 * the bucket and the table to the owning driver, same as discount ID
 * photos on the passenger side).
 *
 * Does not create a `tricycles` row — the registration form collects no
 * vehicle-identifying fields (plate number, MTOP), so there is nothing
 * honest to write there yet. Tricycle records are created during PSO
 * verification review (admin app), not at driver registration.
 */
export async function submitDriverDocuments(
  userId: string,
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

    const { error: insertError } = await getSupabaseClient()
      .from('driver_documents')
      .insert(uploaded.map((u) => ({ driver_id: userId, doc_type: u.docType, storage_path: u.path })));

    if (insertError) {
      await getSupabaseClient()
        .storage.from('driver-docs')
        .remove(uploaded.map((u) => u.path))
        .catch(() => {});
      return { error: insertError.message };
    }

    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Document submission failed' };
  }
}
