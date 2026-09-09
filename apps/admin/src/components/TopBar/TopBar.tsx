import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../Badge';
import { NotificationBell } from '../NotificationBell';
import { ProfileMenu } from '../ProfileMenu';
import { useSessionStore } from '../../store/useSessionStore';
import { useDriversStore } from '../../store/useDriversStore';
import { usePassengersStore } from '../../store/usePassengersStore';
import { ROLE_LABELS } from '../../lib/rbac';
import { visibleNavItems, matchNavItems } from '../../lib/navigation';
import { searchDrivers, searchPassengers } from '../../lib/globalSearch';
import styles from './TopBar.module.css';

interface CombinedResult {
  key: string;
  to: string;
  label: string;
  sublabel?: string;
  group: 'Pages' | 'Drivers' | 'Passengers';
}

export interface TopBarProps {
  title: string;
  onLogoutClick: () => void;
}

/**
 * Wireframe top bar: title + jump-to-page search + PSO role badge + avatar.
 * The dev-only role switcher (docs/ADMIN_TODO.MD F1) is gone now that a real
 * signed-in session drives `user.role` — the badge below reflects it, not a
 * picker. The search box filters the operator's own visible nav sections
 * (so a role that can't see PSO Users / System Settings can't find them
 * here either) and, once cross-entity search was added, also drivers
 * (name/plate/email) and passengers (name/email) — lazily fetched into the
 * same stores Drivers.tsx/Passengers.tsx themselves use, on first query.
 * Selecting a driver/passenger result navigates with a `?highlight=<id>`
 * query param that screen reads to auto-open that row's detail panel.
 * Avatar/name/log out live inside `ProfileMenu`, which also lets the
 * signed-in user rename themselves and change their own password on demand
 * (not just the forced first-login flow).
 */
export function TopBar({ title, onLogoutClick }: TopBarProps) {
  const user = useSessionStore((state) => state.user);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => visibleNavItems(user?.role), [user?.role]);
  const pageMatches = useMemo(() => matchNavItems(query, items).slice(0, 4), [query, items]);

  // Cross-entity search: reuses the same drivers/passengers stores those
  // screens themselves use, fetched lazily here on first query rather than
  // a dedicated search RPC — this app already fetches full lists and
  // filters client-side everywhere else (Drivers.tsx/Passengers.tsx's own
  // search boxes), so this follows that same convention.
  const { drivers, loading: driversLoading, fetch: fetchDrivers } = useDriversStore();
  const { passengers, loading: passengersLoading, fetch: fetchPassengers } = usePassengersStore();

  const trimmedQuery = query.trim();
  useEffect(() => {
    if (!trimmedQuery) return;
    if (drivers.length === 0 && !driversLoading) fetchDrivers();
    if (passengers.length === 0 && !passengersLoading) fetchPassengers();
  }, [trimmedQuery, drivers.length, driversLoading, fetchDrivers, passengers.length, passengersLoading, fetchPassengers]);

  const matches: CombinedResult[] = useMemo(() => {
    const pages: CombinedResult[] = pageMatches.map((item) => ({ key: `page:${item.to}`, to: item.to, label: item.label, group: 'Pages' }));
    return [...pages, ...searchDrivers(query, drivers), ...searchPassengers(query, passengers)];
  }, [pageMatches, query, drivers, passengers]);

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
          placeholder="Search pages, drivers, passengers…"
          aria-label="Search pages, drivers, passengers"
          role="combobox"
          aria-expanded={open}
          aria-controls="topbar-search-results"
          aria-autocomplete="list"
          aria-activedescendant={open && matches[highlight] ? `topbar-search-option-${matches[highlight].key}` : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
          }}
          onKeyDown={handleKeyDown}
        />
        {open && (
          <ul id="topbar-search-results" className={styles.results} role="listbox">
            {matches.length === 0 && <li className={styles.noResults}>No matches</li>}
            {matches.map((item, i) => (
              <li
                key={item.key}
                id={`topbar-search-option-${item.key}`}
                role="option"
                aria-selected={i === highlight}
                className={i === highlight ? styles.resultActive : styles.result}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => go(item.to)}
              >
                <span className={styles.resultGroup}>{item.group}</span>
                <span className={styles.resultLabel}>{item.label}</span>
                {item.sublabel && <span className={styles.resultSublabel}>{item.sublabel}</span>}
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
