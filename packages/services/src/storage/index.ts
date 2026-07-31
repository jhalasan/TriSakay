import { getSupabaseClient } from '../supabase/client';

export interface UploadAvatarInput {
  userId: string;
  /** A local file URI, e.g. from expo-image-picker. */
  uri: string;
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
 * Uploads a local image to the `avatars` bucket under the user's own
 * folder (RLS restricts writes to `{auth.uid()}/*`, so this must run with
 * an active session for that user), then returns its public URL.
 *
 * Does not touch `users.avatar_url` — callers persist that separately so
 * an upload failure and a profile-write failure stay distinguishable.
 */
export async function uploadAvatar({
  userId,
  uri,
  contentType = 'image/jpeg',
}: UploadAvatarInput): Promise<UploadAvatarResult> {
  try {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const path = `${userId}/avatar.${EXTENSION_BY_TYPE[contentType]}`;

    const { error: uploadError } = await getSupabaseClient()
      .storage.from('avatars')
      .upload(path, arrayBuffer, { contentType, upsert: true });

    if (uploadError) return { publicUrl: null, error: uploadError.message };

    const { data } = getSupabaseClient().storage.from('avatars').getPublicUrl(path);
    return { publicUrl: data.publicUrl, error: null };
  } catch (err) {
    return { publicUrl: null, error: err instanceof Error ? err.message : 'Upload failed' };
  }
}
