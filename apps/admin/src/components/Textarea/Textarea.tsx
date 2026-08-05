import type { TextareaHTMLAttributes } from 'react';
import styles from './Textarea.module.css';

/** Wireframe kit "Text area" placeholder used for Notes / Message / Comment fields. */
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className, rows = 4, ...rest }: TextareaProps) {
  return (
    <label className={styles.wrap}>
      {label && <span className={styles.label}>{label}</span>}
      <textarea rows={rows} className={[styles.textarea, className].filter(Boolean).join(' ')} {...rest} />
    </label>
  );
}
