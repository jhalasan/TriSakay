import type { CSSProperties, ReactNode } from 'react';
import styles from './PlaceholderBox.module.css';

/**
 * Wireframe kit §Part 0 "Chart / map / image" (.ph-box) — the crossed box
 * standing in for any data visual, map, or document image. No image asset
 * or chart library; the X is drawn in CSS (see src/styles/globals.css .ph-box).
 */
export interface PlaceholderBoxProps {
  label: string;
  height?: number;
  children?: ReactNode;
}

export function PlaceholderBox({ label, height = 220, children }: PlaceholderBoxProps) {
  const style: CSSProperties = { height };
  return (
    <div className={`ph-box ${styles.box}`} style={style}>
      {children ?? <span className="ph-box__label">{label}</span>}
    </div>
  );
}
