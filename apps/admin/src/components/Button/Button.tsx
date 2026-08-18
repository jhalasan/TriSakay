import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

/** Wireframe kit §Part 0 "Buttons" (.btn) — plain rectangles; solid = strong fill, outline, small. */
export type ButtonVariant = 'solid' | 'outline' | 'ghost';
export type ButtonTone = 'primary' | 'neutral' | 'danger';
export type ButtonSize = 'md' | 'sm';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  /** Wireframe's literal "Verify^S+" marker — an S+-gated action, visible on the button once RoleGate has already let it render. */
  superscript?: string;
}

export function Button({
  variant = 'solid',
  tone = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  superscript,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const classes = [
    styles.base,
    styles[variant],
    styles[tone],
    styles[size],
    loading && styles.loading,
    fullWidth && styles.fullWidth,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading && (
        <svg className={styles.spinner} viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
          <circle cx="12" cy="12" r="9.5" fill="none" strokeWidth="3" stroke="currentColor" strokeOpacity="0.25" />
          <path d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5" fill="none" strokeWidth="3" stroke="currentColor" strokeLinecap="round" />
        </svg>
      )}
      {children}
      {superscript && <sup className={styles.superscript}>{superscript}</sup>}
    </button>
  );
}
