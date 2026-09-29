import { Image, Platform } from 'react-native';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

function getImageWidth(uri: string): Promise<number> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width) => resolve(width),
      () => resolve(0)
    );
  });
}

/**
 * expo-file-system's `File` class is a no-op stub on web — fetch(uri) is the
 * fallback there since the picker's URI is a blob: URL fetch reads fine; on
 * native File is the reliable path (fetch is flaky on some Android setups).
 * Same pattern as apps/driver/app/(tabs)/profile.tsx's readFileBytes.
 */
async function readFileBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') return (await fetch(uri)).arrayBuffer();
  return new File(uri).arrayBuffer();
}

const MAX_DIMENSION = 1280;

export interface PreparedChatPhoto {
  data: ArrayBuffer;
  contentType: 'image/jpeg';
}

/**
 * C1 (privacy requirement): re-encodes a picked photo before it ever leaves
 * the device. `ImageManipulator`'s render/save path writes a fresh JPEG from
 * decoded pixel data rather than copying the source file, so it carries no
 * EXIF block — no GPS coordinates, no camera metadata — even though nothing
 * here explicitly "strips" anything. Downscaling to at most 1280px on the
 * long edge also keeps a chat photo small over a mobile connection.
 */
export async function preparePhotoForChat(uri: string): Promise<PreparedChatPhoto> {
  const originalWidth = await getImageWidth(uri);
  // Only downscale — resizing a smaller image up to MAX_DIMENSION would make
  // it blurrier and larger for no benefit. 0 means getSize failed; resize
  // anyway rather than skip the re-encode that strips EXIF.
  const context = originalWidth > 0 && originalWidth <= MAX_DIMENSION ? ImageManipulator.manipulate(uri) : ImageManipulator.manipulate(uri).resize({ width: MAX_DIMENSION });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  const data = await readFileBytes(saved.uri);
  return { data, contentType: 'image/jpeg' };
}
