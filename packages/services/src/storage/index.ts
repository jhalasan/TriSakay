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

    const { data: publicUrlData } = getSupabaseClient().storage.from('avatars').getPublicUrl(path);
    return { publicUrl: publicUrlData.publicUrl, error: null };
  } catch (err) {
    return { publicUrl: null, error: err instanceof Error ? err.message : 'Upload failed' };
  }
}
