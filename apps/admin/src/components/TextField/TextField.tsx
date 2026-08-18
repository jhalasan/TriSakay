import type { InputHTMLAttributes, ReactNode } from 'react';
import styles from './TextField.module.css';

/** Wireframe kit §Part 0 "Input field" (.field) — bordered rectangle, label above. */
export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  /** Optional trailing control inside the input box (e.g. a password visibility toggle). */
  endAdornment?: ReactNode;
}

export function TextField({ label, hint, className, endAdornment, ...rest }: TextFieldProps) {
  return (
    <label className={styles.wrap}>
      {label && <span className={styles.label}>{label}</span>}
      {endAdornment ? (
        <span className={styles.inputWrap}>
          <input
            className={[styles.input, styles.hasAdornment, className].filter(Boolean).join(' ')}
            {...rest}
          />
          <span className={styles.adornment}>{endAdornment}</span>
        </span>
      ) : (
        <input className={[styles.input, className].filter(Boolean).join(' ')} {...rest} />
      )}
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}
