import type { TextareaHTMLAttributes } from 'react';
import styles from './Textarea.module.css';

/** Wireframe kit "Text area" placeholder used for Notes / Message / Comment fields. */
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  /** README §12 "Field-level validation" — red border + one line beneath. */
  error?: string;
}

export function Textarea({ label, error, className, rows = 4, ...rest }: TextareaProps) {
  return (
    <label className={styles.wrap}>
      {label && <span className={styles.label}>{label}</span>}
      <textarea
        rows={rows}
        className={[styles.textarea, error && styles.textareaError, className].filter(Boolean).join(' ')}
        aria-invalid={!!error}
        {...rest}
      />
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
