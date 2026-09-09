import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../Badge';
import { NotificationBell } from '../NotificationBell';
import { ProfileMenu } from '../ProfileMenu';
import { useSessionStore } from '../../store/useSessionStore';
import { ROLE_LABELS } from '../../lib/rbac';
import { visibleNavItems, matchNavItems } from '../../lib/navigation';
import styles from './TopBar.module.css';

export interface TopBarProps {
  title: string;
  onLogoutClick: () => void;
}

/**
 * Wireframe top bar: title + jump-to-page search + PSO role badge + avatar.
 * The dev-only role switcher (docs/ADMIN_TODO.MD F1) is gone now that a real
 * signed-in session drives `user.role` — the badge below reflects it, not a
 * picker. The search box was previously decorative (no state/handler); it
 * now filters the operator's own visible nav sections and navigates on
 * Enter, so a role that can't see PSO Users / System Settings can't find
 * them here either. Avatar/name/log out live inside `ProfileMenu`, which
 * also lets the signed-in user rename themselves and change their own
 * password on demand (not just the forced first-login flow).
 */
export function TopBar({ title, onLogoutClick }: TopBarProps) {
  const user = useSessionStore((state) => state.user);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => visibleNavItems(user?.role), [user?.role]);
  const matches = useMemo(() => matchNavItems(query, items).slice(0, 6), [query, items]);

  if (!user) return null;

  function go(to: string) {
    navigate(to);
    setQuery('');
    setHighlight(0);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (matches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(matches[highlight].to);
    } else if (e.key === 'Escape') {
      setQuery('');
      setHighlight(0);
    }
  }

  const open = query.trim().length > 0;

  return (
    <header className={styles.bar}>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.searchWrap}>
        <input
          ref={inputRef}
          className={styles.search}
          placeholder="Jump to page…"
          aria-label="Jump to page"
          role="combobox"
          aria-expanded={open}
          aria-controls="topbar-search-results"
          aria-autocomplete="list"
          aria-activedescendant={open && matches[highlight] ? `topbar-search-option-${matches[highlight].to}` : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
          }}
          onKeyDown={handleKeyDown}
        />
        {open && (
          <ul id="topbar-search-results" className={styles.results} role="listbox">
            {matches.length === 0 && <li className={styles.noResults}>No matching pages</li>}
            {matches.map((item, i) => (
              <li
                key={item.to}
                id={`topbar-search-option-${item.to}`}
                role="option"
                aria-selected={i === highlight}
                className={i === highlight ? styles.resultActive : styles.result}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => go(item.to)}
              >
                {item.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={styles.right}>
        <Badge label={ROLE_LABELS[user.role]} tone="info" />
        <NotificationBell />
        <ProfileMenu onLogoutClick={onLogoutClick} />
      </div>
    </header>
  );
}
