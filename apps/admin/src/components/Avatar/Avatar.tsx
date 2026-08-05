import { initials } from '../../lib/format';
import styles from './Avatar.module.css';

/** Wireframe kit §Part 0 "Avatar" (.avatar) — circular gray placeholder for a Driver/Passenger/PSO user. */
export interface AvatarProps {
  fullName: string;
  size?: number;
}

export function Avatar({ fullName, size = 34 }: AvatarProps) {
  return (
    <div className={styles.avatar} style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
      {initials(fullName)}
    </div>
  );
}
