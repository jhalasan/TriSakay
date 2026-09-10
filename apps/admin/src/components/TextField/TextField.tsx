import type { InputHTMLAttributes, ReactNode } from 'react';
import styles from './TextField.module.css';

/** Wireframe kit §Part 0 "Input field" (.field) — bordered rectangle, label above. */
export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  /** README §12 "Field-level validation" — red border + one line beneath, height reserved so nothing shifts. */
  error?: string;
  /** Optional trailing control inside the input box (e.g. a password visibility toggle). */
  endAdornment?: ReactNode;
}

export function TextField({ label, hint, error, className, endAdornment, ...rest }: TextFieldProps) {
  return (
    <label className={styles.wrap}>
      {label && <span className={styles.label}>{label}</span>}
      {endAdornment ? (
        <span className={styles.inputWrap}>
          <input
            className={[styles.input, styles.hasAdornment, error && styles.inputError, className].filter(Boolean).join(' ')}
            aria-invalid={!!error}
            {...rest}
          />
          <span className={styles.adornment}>{endAdornment}</span>
        </span>
      ) : (
        <input
          className={[styles.input, error && styles.inputError, className].filter(Boolean).join(' ')}
          aria-invalid={!!error}
          {...rest}
        />
      )}
      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : (
        hint && <span className={styles.hint}>{hint}</span>
      )}
    </label>
  );
}
