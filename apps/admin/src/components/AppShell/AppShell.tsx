import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from '../Sidebar';
import { TopBar } from '../TopBar';
import { ConfirmModal } from '../ConfirmModal';
import { useSessionStore } from '../../store/useSessionStore';
import { ROUTE_TITLES } from '../../lib/navigation';
import { getDashboardStats } from '../../services/dashboard';
import styles from './AppShell.module.css';

/**
 * Sidebar (236px) + top bar + content frame, wrapping every authenticated
 * route via <Outlet/>. Screen 11 "Log out" — dimmed overlay confirm modal —
 * lives here since it can be triggered from any page, not just one route.
 */
export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const signOut = useSessionStore((state) => state.signOut);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  // Rail count chips (README §3 item 3) reuse the existing dashboard stats
  // call rather than a new endpoint — it already carries two of the four
  // numbers the redesign wants (Verification, Complaints). Fare Discounts
  // and Emergency Alerts have no equivalent lightweight count yet, so their
  // keys are simply omitted and Sidebar renders those items with no chip.
  const [navCounts, setNavCounts] = useState<Partial<Record<string, number>>>({});
  useEffect(() => {
    let cancelled = false;
    getDashboardStats().then(({ data }) => {
      if (cancelled || !data) return;
      setNavCounts({
        '/verification': data.pendingVerifications,
        '/complaints': data.openComplaints,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const title = ROUTE_TITLES[location.pathname] ?? 'TriSakay Admin';

  return (
    <div className={styles.shell}>
      <Sidebar counts={navCounts} onLogoutClick={() => setConfirmingLogout(true)} />
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
          tone="primary"
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
