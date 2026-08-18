import { Avatar } from '../Avatar';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { useSessionStore } from '../../store/useSessionStore';
import { ROLE_LABELS } from '../../lib/rbac';
import styles from './TopBar.module.css';

export interface TopBarProps {
  title: string;
  onLogoutClick: () => void;
}

/**
 * Wireframe top bar: title + search + PSO role badge + avatar. The dev-only
 * role switcher (docs/ADMIN_TODO.MD F1) is gone now that a real signed-in
 * session drives `user.role` — the badge below reflects it, not a picker.
 */
export function TopBar({ title, onLogoutClick }: TopBarProps) {
  const user = useSessionStore((state) => state.user);

  if (!user) return null;

  return (
    <header className={styles.bar}>
      <h1 className={styles.title}>{title}</h1>
      <input className={styles.search} placeholder="Search…" aria-label="Global search" />
      <div className={styles.right}>
        <Badge label={ROLE_LABELS[user.role]} tone="info" />
        <Avatar fullName={user.fullName} size={30} />
        <Button variant="outline" tone="neutral" size="sm" onClick={onLogoutClick}>
          Log out
        </Button>
      </div>
    </header>
  );
}
