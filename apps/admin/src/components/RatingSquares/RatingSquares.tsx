import styles from './RatingSquares.module.css';

/** Wireframe kit §Part 0 "Rating" (.stars) — icon-free 1-5 rating: filled vs. empty squares. */
export interface RatingSquaresProps {
  value: number; // 0-5, may be fractional (rounds down for the filled count)
  size?: number;
}

export function RatingSquares({ value, size = 12 }: RatingSquaresProps) {
  const filled = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className={styles.row} aria-label={`${value.toFixed(1)} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={i < filled ? styles.filled : styles.empty}
          style={{ width: size, height: size }}
        />
      ))}
    </span>
  );
}
