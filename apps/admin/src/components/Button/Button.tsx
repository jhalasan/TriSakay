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
      {children}
      {superscript && <sup className={styles.superscript}>{superscript}</sup>}
    </button>
  );
}
