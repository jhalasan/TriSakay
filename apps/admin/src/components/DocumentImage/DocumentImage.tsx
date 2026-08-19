import { useEffect, useState } from 'react';
import { getSignedDocumentUrl, type DocumentBucket } from '../../services/documents.ts';
import styles from './DocumentImage.module.css';

export interface DocumentImageProps {
  bucket: DocumentBucket;
  path: string;
  alt: string;
  height?: number;
}

type LoadState = 'loading' | 'ready' | 'error';

/**
 * Renders a private-bucket document (driver verification photos, discount
 * ID photos) via a short-lived signed URL. Falls back to the existing
 * crossed-box `.ph-box` look — reused as a CSS class, not the
 * PlaceholderBox component — while loading or on failure, so a missing/
 * expired document still reads clearly as "no image" rather than a broken
 * `<img>` icon.
 */
export function DocumentImage({ bucket, path, alt, height = 160 }: DocumentImageProps) {
  const [state, setState] = useState<LoadState>('loading');
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setUrl(null);

    getSignedDocumentUrl(bucket, path).then((res) => {
      if (cancelled) return;
      if (res.error || !res.url) {
        setState('error');
        return;
      }
      setUrl(res.url);
      setState('ready');
    });

    return () => {
      cancelled = true;
    };
  }, [bucket, path]);

  if (state === 'ready' && url) {
    return <img src={url} alt={alt} className={styles.image} style={{ height }} />;
  }

  return (
    <div className={`ph-box ${styles.fallback}`} style={{ height }}>
      <span className="ph-box__label">{state === 'error' ? "Couldn't load document" : 'Loading…'}</span>
    </div>
  );
}
