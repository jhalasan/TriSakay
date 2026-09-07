import styles from './ErrorBanner.module.css';

export interface ErrorBannerProps {
  message: string | null | undefined;
}

/** Page-level error banner — the copy-pasted inline-styled div every route used to render by hand. */
export function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) return null;
  return (
    <div className={styles.banner} role="alert">
      {message}
    </div>
  );
}
