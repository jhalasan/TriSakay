import { NavLink } from 'react-router-dom';
import { RoleGate } from '../RoleGate';
import styles from './Sidebar.module.css';

interface NavItem {
  to: string;
  label: string;
}

const CORE_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/drivers', label: 'Drivers' },
  { to: '/verification', label: 'Verification' },
  { to: '/passengers', label: 'Passengers' },
  { to: '/monitoring', label: 'Ride Monitoring' },
  { to: '/complaints', label: 'Complaints' },
  { to: '/reports', label: 'Reports & Analytics' },
  { to: '/rating-oversight', label: 'Rating Oversight' },
  { to: '/discounts', label: 'Fare Discounts' },
  { to: '/emergency-alerts', label: 'Emergency Alerts' },
];

const ADMIN_ITEMS: NavItem[] = [
  { to: '/pso-users', label: 'PSO Users' },
  { to: '/settings', label: 'System Settings' },
];

/**
 * 176px wireframe sidebar (docs/CONTEXT.MD §7 Admin Web App feature split).
 * PSO Users and System Settings are Admin-only (FR-6.3, FR-8.1) and are
 * filtered out of the nav entirely for PSO Staff/Supervisor, not merely
 * disabled.
 */
export function Sidebar() {
  return (
    <nav className={styles.sidebar} aria-label="Admin navigation">
      <div className={styles.brand}>
        <img src="/brand/trisakay-mark.png" alt="" className={styles.brandMark} />
        <span className={styles.brandWordmark}>TriSakay Admin</span>
      </div>
      <ul className={styles.list}>
        {CORE_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} end={item.to === '/'} className={({ isActive }) => (isActive ? styles.active : styles.link)}>
              {item.label}
            </NavLink>
          </li>
        ))}
        <RoleGate min="admin">
          <li className={styles.divider} />
          {ADMIN_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} className={({ isActive }) => (isActive ? styles.active : styles.link)}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </RoleGate>
      </ul>
    </nav>
  );
}
