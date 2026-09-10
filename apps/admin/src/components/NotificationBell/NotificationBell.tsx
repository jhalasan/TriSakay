import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { NotificationRow } from '@trisakay/services';
import { useSessionStore } from '../../store/useSessionStore';
import { useNotificationsStore } from '../../store/useNotificationsStore';
import { formatRelativeTime } from '../../lib/format';
import styles from './NotificationBell.module.css';

const TYPE_ROUTE: Partial<Record<NotificationRow['type'], string>> = {
  emergency_alert: '/emergency-alerts',
};

/**
 * Reads the notifications table (docs/SCHEMA.MD §3.5) via the already-generic
 * subscribeToNotifications() in @trisakay/services — live for driver/passenger
 * apps' data model already, just never consumed by any UI until now.
 * PSO accounts only ever receive `emergency_alert` rows in practice
 * (notify_pso_on_emergency() broadcasts to every pso_staff+/supervisor/admin
 * account on every SOS trigger); franchise-expiry notifications are
 * driver-facing, not PSO-facing, despite living in the same table.
 */
export function NotificationBell() {
  const user = useSessionStore((state) => state.user);
  const { notifications, connect, disconnect, markRead, markAllRead } = useNotificationsStore();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    connect(userId);
    return () => disconnect();
  }, [userId, connect, disconnect]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!user) return null;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  function handleItemClick(n: NotificationRow) {
    if (!n.is_read) void markRead(n.id);
    const route = TYPE_ROUTE[n.type];
    if (route) {
      navigate(route);
      setOpen(false);
    }
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unreadCount > 0 && <span className={styles.dot} />}
      </button>

      {open && (
        <div className={styles.panel} role="menu">
          <div className={styles.header}>
            <span className={styles.headerTitle}>Notifications</span>
            <button type="button" className={styles.markAllButton} onClick={() => markAllRead()} disabled={unreadCount === 0}>
              Mark all read
            </button>
          </div>
          <div className={styles.list}>
            {notifications.length === 0 && <div className={styles.empty}>No notifications yet.</div>}
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`${styles.item} ${!n.is_read ? styles.itemUnread : ''}`}
                onClick={() => handleItemClick(n)}
              >
                <div className={styles.itemHeader}>
                  <span className={styles.itemTitle}>{n.title}</span>
                  <span className={styles.itemTime}>{formatRelativeTime(n.created_at)}</span>
                </div>
                <p className={styles.itemMessage}>{n.message}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
