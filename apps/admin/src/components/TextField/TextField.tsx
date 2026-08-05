import type { InputHTMLAttributes } from 'react';
import styles from './TextField.module.css';

/** Wireframe kit §Part 0 "Input field" (.field) — bordered rectangle, label above. */
export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export function TextField({ label, hint, className, ...rest }: TextFieldProps) {
  return (
    <label className={styles.wrap}>
      {label && <span className={styles.label}>{label}</span>}
      <input className={[styles.input, className].filter(Boolean).join(' ')} {...rest} />
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}
