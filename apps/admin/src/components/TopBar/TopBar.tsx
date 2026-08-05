import { Avatar } from '../Avatar';
import { Badge } from '../Badge';
import { Select } from '../Select';
import { Button } from '../Button';
import { useSessionStore } from '../../store/useSessionStore';
import { ROLE_LABELS } from '../../lib/rbac';
import type { AdminRole } from '../../types/role';
import styles from './TopBar.module.css';

const ROLE_OPTIONS: { label: string; value: AdminRole }[] = [
  { label: 'View as: PSO Staff', value: 'pso_staff' },
  { label: 'View as: PSO Supervisor', value: 'pso_supervisor' },
  { label: 'View as: Administrator', value: 'admin' },
];

export interface TopBarProps {
  title: string;
  onLogoutClick: () => void;
}

/**
 * Wireframe top bar: title + search + PSO role badge + avatar. The role
 * switcher is a DEV-ONLY affordance for this frontend-only pass — it lets
 * every RBAC tier (Staff / Supervisor / Admin) be demonstrated without a
 * real session. Removing it (in favor of the real signed-in role) is
 * docs/ADMIN_TODO.MD F1.
 */
export function TopBar({ title, onLogoutClick }: TopBarProps) {
  const user = useSessionStore((state) => state.user);
  const setRole = useSessionStore((state) => state.setRole);

  if (!user) return null;

  return (
    <header className={styles.bar}>
      <h1 className={styles.title}>{title}</h1>
      <input className={styles.search} placeholder="Search…" aria-label="Global search" />
      <div className={styles.right}>
        <Select
          aria-label="Role switcher (dev only)"
          options={ROLE_OPTIONS}
          value={user.role}
          onChange={(e) => setRole(e.target.value as AdminRole)}
          className={styles.roleSelect}
        />
        <Badge label="PSO" tone="info" />
        <Avatar fullName={user.fullName} size={30} />
        <Button variant="outline" tone="neutral" size="sm" onClick={onLogoutClick}>
          Log out
        </Button>
      </div>
    </header>
  );
}
