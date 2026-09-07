import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from '../Sidebar';
import { TopBar } from '../TopBar';
import { ConfirmModal } from '../ConfirmModal';
import { useSessionStore } from '../../store/useSessionStore';
import { ROUTE_TITLES } from '../../lib/navigation';
import styles from './AppShell.module.css';

/**
 * Sidebar (176px, wireframe-exact) + top bar + content frame, wrapping
 * every authenticated route via <Outlet/>. Screen 11 "Log out" — dimmed
 * overlay confirm modal — lives here since it can be triggered from any
 * page, not just one route.
 */
export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const signOut = useSessionStore((state) => state.signOut);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const title = ROUTE_TITLES[location.pathname] ?? 'TriSakay Admin';

  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.main}>
        <TopBar title={title} onLogoutClick={() => setConfirmingLogout(true)} />
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
      {confirmingLogout && (
        <ConfirmModal
          title="Log out"
          message="Are you sure you want to log out of TriSakay Admin?"
          confirmLabel="Log out"
          tone="danger"
          onCancel={() => setConfirmingLogout(false)}
          onConfirm={async () => {
            // signOut() is a real async Supabase call now — navigating before
            // it resolves would hit /login while isAuthenticated is still
            // stale-true, and RedirectIfAuthed would bounce straight back.
            await signOut();
            navigate('/login', { replace: true });
          }}
        />
      )}
    </div>
  );
}
