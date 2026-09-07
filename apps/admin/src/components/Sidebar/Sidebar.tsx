import { Fragment } from 'react';
import { NavLink } from 'react-router-dom';
import { RoleGate } from '../RoleGate';
import { NAV_GROUPS } from '../../lib/navigation';
import styles from './Sidebar.module.css';

const ADMIN_CAPTION = 'Administration';

/**
 * 176px wireframe sidebar (docs/CONTEXT.MD §7 Admin Web App feature split),
 * grouped by operator workflow (NAV_GROUPS in lib/navigation.ts) rather than
 * a flat list. PSO Users and System Settings are Admin-only (FR-6.3, FR-8.1)
 * and are filtered out of the nav entirely for PSO Staff/Supervisor, not
 * merely disabled — the Administration group keeps its own RoleGate wrapper.
 */
export function Sidebar() {
  return (
    <nav className={styles.sidebar} aria-label="Admin navigation">
      <div className={styles.brand}>
        <img src="/brand/trisakay-mark.png" alt="" className={styles.brandMark} />
        <span className={styles.brandWordmark}>TriSakay Admin</span>
      </div>
      <ul className={styles.list}>
        {NAV_GROUPS.map((group) => {
          const items = (
            <>
              <li className={styles.captionItem}>
                <h2 className={styles.caption}>{group.caption}</h2>
              </li>
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.to === '/'} className={({ isActive }) => (isActive ? styles.active : styles.link)}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </>
          );
          if (group.caption === ADMIN_CAPTION) {
            return (
              <RoleGate min="admin" key={group.caption}>
                <li className={styles.divider} />
                {items}
              </RoleGate>
            );
          }
          return <Fragment key={group.caption}>{items}</Fragment>;
        })}
      </ul>
    </nav>
  );
}
