import { getSignedDocumentUrl } from '../../services/documents.ts';
import type { ComplaintEvidenceItem } from './complaintReport.ts';

/** At most this many pictures are drawn in a report; the rest are still listed by file name. */
export const MAX_EVIDENCE_IMAGES = 6;
const MAX_SIDE_PX = 1100;
const IMAGE_FILE = /\.(jpe?g|png|webp)$/i;

/** Returns the picture as a data URL, or null when it could not be loaded. */
export type ImageLoader = (storagePath: string) => Promise<string | null>;

function fileName(storagePath: string): string {
  return storagePath.split('/').pop() ?? storagePath;
}

/**
 * Lists every attachment and loads the first few pictures. A picture that fails (or a loader that throws) is
 * flagged in the list, never an error: a missing evidence photo must not stop the report from printing.
 */
export async function loadEvidenceItems(attachments: { storagePath: string }[], loadImage: ImageLoader): Promise<ComplaintEvidenceItem[]> {
  const items: ComplaintEvidenceItem[] = [];
  let loadedCount = 0;

  for (const attachment of attachments) {
    const name = fileName(attachment.storagePath);
    if (!IMAGE_FILE.test(name) || loadedCount >= MAX_EVIDENCE_IMAGES) {
      items.push({ name });
      continue;
    }
    loadedCount++;
    let dataUrl: string | null = null;
    try {
      dataUrl = await loadImage(attachment.storagePath);
    } catch {
      dataUrl = null;
    }
    items.push(dataUrl ? { name, imageDataUrl: dataUrl } : { name, imageDataUrl: null, imageFailed: true });
  }
  return items;
}

/** Browser loader: signed URL, then a canvas to shrink the picture so the PDF stays small. */
export const browserImageLoader: ImageLoader = async (storagePath) => {
  const { url } = await getSignedDocumentUrl('complaint-evidence', storagePath);
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) return null;

  const bitmap = await createImageBitmap(await response.blob());
  const scale = Math.min(1, MAX_SIDE_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
};
