import type { SelectHTMLAttributes } from 'react';
import styles from './Select.module.css';

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  options: SelectOption[];
  /** README §12 "Field-level validation" — red border + one line beneath. */
  error?: string;
}

/** Used for the wireframe's Filter / Status / Priority / Report type dropdowns. */
export function Select({ label, options, error, className, ...rest }: SelectProps) {
  return (
    <label className={styles.wrap}>
      {label && <span className={styles.label}>{label}</span>}
      <select
        className={[styles.select, error && styles.selectError, className].filter(Boolean).join(' ')}
        aria-invalid={!!error}
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
