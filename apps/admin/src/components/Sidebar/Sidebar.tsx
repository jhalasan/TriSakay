import { Fragment } from 'react';
import { NavLink } from 'react-router-dom';
import { RoleGate } from '../RoleGate';
import { Avatar } from '../Avatar';
import { useSessionStore } from '../../store/useSessionStore';
import { NAV_GROUPS } from '../../lib/navigation';
import { ROLE_LABELS } from '../../lib/rbac';
import { NAV_ICONS } from './navIcons';
import styles from './Sidebar.module.css';

const ADMIN_CAPTION = 'Administration';

export interface SidebarProps {
  /** Rail count chips, keyed by NavItem.to — Emergency Alerts, Verification, Fare Discounts and Complaints per README §3 item 3. Omit a key to render that item with no chip (data not available yet). */
  counts?: Partial<Record<string, number>>;
  onLogoutClick: () => void;
  /**
   * P1-23 (2026-09-15 launch audit): below 900px the sidebar becomes an
   * off-canvas drawer — `open` drives its slide-in transform and the
   * backdrop's visibility, `onClose` fires from the backdrop tap, the
   * mobile-only close button, and every nav link (so picking a destination
   * also dismisses the drawer). Both props are inert above 900px, where CSS
   * keeps the sidebar permanently visible regardless of this state.
   */
  open: boolean;
  onClose: () => void;
}

/**
 * 236px navy rail (docs/design_handoff_trisakay_admin/README.md §1 shell
 * anatomy), grouped by operator workflow (NAV_GROUPS in lib/navigation.ts).
 * PSO Users, Barangays and System Settings are Admin-only (FR-6.3, FR-8.1)
 * and are filtered out of the nav entirely for PSO Staff/Supervisor, not
 * merely disabled — the Administration group keeps its own RoleGate wrapper.
 */
export function Sidebar({ counts, onLogoutClick, open, onClose }: SidebarProps) {
  const user = useSessionStore((state) => state.user);

  return (
    <>
      {/* Mobile-only backdrop — CSS hides this entirely above 900px, so
          `open` has no visible effect on desktop regardless of its value. */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        className={`${styles.backdrop} ${open ? styles.backdropVisible : ''}`}
        onClick={onClose}
      />
      <nav className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`} aria-label="Admin navigation">
        <div className={styles.brand}>
          <svg className={styles.brandArt} viewBox="0 0 176 88" fill="none" aria-hidden="true">
            <path
              d="M-10 20 C 40 6, 60 46, 110 34 S 170 8, 210 24"
              stroke="white"
              strokeOpacity="0.5"
              strokeWidth="2"
              strokeDasharray="1 10"
              strokeLinecap="round"
            />
            <path
              d="M-10 66 C 30 54, 55 84, 100 72 S 160 50, 200 64"
              stroke="white"
              strokeOpacity="0.3"
              strokeWidth="2"
              strokeDasharray="1 10"
              strokeLinecap="round"
            />
          </svg>
          <span className={styles.brandTile}>
            <img src="/brand/trisakay-mark.png" alt="" className={styles.brandMark} />
          </span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>TriSakay</span>
            <span className={styles.brandCaption}>PSO Portal</span>
          </span>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close navigation">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <ul className={styles.list}>
          {NAV_GROUPS.map((group) => {
            const items = (
              <Fragment key={group.caption}>
                <li className={styles.captionItem}>
                  <h2 className={styles.caption}>{group.caption}</h2>
                </li>
                {group.items.map((item) => {
                  const Icon = NAV_ICONS[item.to];
                  const count = counts?.[item.to];
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === '/'}
                        className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ''}`}
                        onClick={onClose}
                      >
                        {Icon && <Icon className={styles.icon} />}
                        <span className={styles.label}>{item.label}</span>
                        {!!count && <span className={styles.chip}>{count}</span>}
                      </NavLink>
                    </li>
                  );
                })}
              </Fragment>
            );
            if (group.caption === ADMIN_CAPTION) {
              return (
                <RoleGate min="admin" key={group.caption}>
                  <li className={styles.divider} />
                  {items}
                </RoleGate>
              );
            }
            return items;
          })}
        </ul>
        {user && (
          <div className={styles.footer}>
            <Avatar fullName={user.fullName} size={30} />
            <span className={styles.footerText}>
              <span className={styles.footerName}>{user.fullName}</span>
              <span className={styles.footerRole}>{ROLE_LABELS[user.role]}</span>
            </span>
            <button type="button" className={styles.logoutButton} onClick={onLogoutClick} aria-label="Log out">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15.5 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7.5a2 2 0 0 0 2-2v-2" />
                <path d="M9.5 12H21M21 12l-3-3M21 12l-3 3" />
              </svg>
            </button>
          </div>
        )}
      </nav>
    </>
  );
}
