import { useEffect, useState } from 'react';
import { getSignedDocumentUrl, type DocumentBucket } from '../../services/documents.ts';
import { SkeletonBlock } from '../Skeleton';
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
 * ID photos) via a short-lived signed URL. Shows a shimmer skeleton while
 * the signed URL is being fetched, and the crossed-box `.ph-box` look only
 * once that fetch has actually failed — the X previously appeared for both
 * states, which read as an error even while the document was still just
 * loading normally.
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

  if (state === 'loading') {
    return <SkeletonBlock height={height} />;
  }

  return (
    <div className={`ph-box ${styles.fallback}`} style={{ height }}>
      <span className="ph-box__label">Couldn't load document</span>
    </div>
  );
}
