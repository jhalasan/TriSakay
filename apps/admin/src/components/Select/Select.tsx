import type { SelectHTMLAttributes } from 'react';
import styles from './Select.module.css';

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  options: SelectOption[];
}

/** Used for the wireframe's Filter / Status / Priority / Report type dropdowns. */
export function Select({ label, options, className, ...rest }: SelectProps) {
  return (
    <label className={styles.wrap}>
      {label && <span className={styles.label}>{label}</span>}
      <select className={[styles.select, className].filter(Boolean).join(' ')} {...rest}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
