import { getSignedDocumentUrl as getSignedDocumentUrlShared } from '@trisakay/services';

export type DocumentBucket = 'driver-docs' | 'discount-ids';

/** Thin wrapper matching this app's one-file-per-feature service convention. */
export async function getSignedDocumentUrl(bucket: DocumentBucket, path: string): Promise<{ url: string | null; error: string | null }> {
  return getSignedDocumentUrlShared(bucket, path);
}
