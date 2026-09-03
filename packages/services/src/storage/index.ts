import { getSupabaseClient } from '../supabase/client.ts';

export interface UploadAvatarInput {
  userId: string;
  /**
   * Raw file bytes, not a URI — React Native's `fetch(uri).arrayBuffer()`
   * on a local `file://`/`content://` picker URI is unreliable (silently
   * produces an empty body on some Android setups, which uploads
   * "successfully" as a zero-byte object with no error to catch). Callers
   * read the file themselves (e.g. `expo-file-system` + `base64-arraybuffer`)
   * so this package stays platform-agnostic and Node-testable.
   */
  data: ArrayBuffer | Uint8Array;
  contentType?: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface UploadAvatarResult {
  publicUrl: string | null;
  error: string | null;
}

const EXTENSION_BY_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

/**
 * Uploads image bytes to the `avatars` bucket under the user's own folder
 * (RLS restricts writes to `{auth.uid()}/*`, so this must run with an active
 * session for that user), then returns its public URL.
 *
 * Does not touch `users.avatar_url` — callers persist that separately so
 * an upload failure and a profile-write failure stay distinguishable.
 */
export async function uploadAvatar({
  userId,
  data,
  contentType = 'image/jpeg',
}: UploadAvatarInput): Promise<UploadAvatarResult> {
  try {
    const path = `${userId}/avatar.${EXTENSION_BY_TYPE[contentType]}`;

    const { error: uploadError } = await getSupabaseClient()
      .storage.from('avatars')
      .upload(path, data, { contentType, upsert: true });

    if (uploadError) return { publicUrl: null, error: uploadError.message };

    // The path is deterministic and re-uploaded with `upsert: true`, so the
    // public URL is byte-identical across uploads — without a cache-busting
    // query param, RN's `Image` (and any CDN in front of the bucket) keeps
    // serving the previously cached bytes for that exact URI, and a changed
    // avatar never visibly updates even though the upload itself succeeded.
    const { data: publicUrlData } = getSupabaseClient().storage.from('avatars').getPublicUrl(path);
    return { publicUrl: `${publicUrlData.publicUrl}?v=${Date.now()}`, error: null };
  } catch (err) {
    return { publicUrl: null, error: err instanceof Error ? err.message : 'Upload failed' };
  }
}

export interface GetSignedDocumentUrlResult {
  url: string | null;
  error: string | null;
}

/**
 * Time-limited read URL for a private-bucket document (driver verification
 * photos, discount ID photos). Both buckets already grant `is_pso()` a
 * `SELECT` policy on `storage.objects` (verified live against the project),
 * so a signed-in PSO/Supervisor/Admin session can call this directly — no
 * RPC or service-role key needed, unlike the write-side account actions.
 */
export async function getSignedDocumentUrl(
  bucket: 'driver-docs' | 'discount-ids',
  path: string,
  expirySeconds = 300
): Promise<GetSignedDocumentUrlResult> {
  const { data, error } = await getSupabaseClient().storage.from(bucket).createSignedUrl(path, expirySeconds);
  if (error) return { url: null, error: error.message };
  return { url: data.signedUrl, error: null };
}
