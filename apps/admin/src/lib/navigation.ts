import { meetsRoleGate, type RoleGateLevel } from './rbac.ts';
import type { AdminRole } from '../types/role.ts';

export interface NavItem {
  to: string;
  label: string;
  title: string;
  min: RoleGateLevel;
}

export interface NavGroup {
  caption: string;
  items: NavItem[];
}

/**
 * Single source of truth for the sidebar, the AppShell page title, and the
 * top-bar jump-to search.
 *
 * Grouping/order/captions per the locked redesign
 * (docs/design_handoff_trisakay_admin/README.md §1 and §3 item 2) — an
 * intentional, deliberate regroup from the prior Overview / Live Operations
 * / Directory / Review Queues / Insights / Administration shape. `to`,
 * `label`, `title` and `min` are unchanged for every item; only which group
 * each sits in, the group captions, and the item order move.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    caption: 'Operations',
    items: [
      { to: '/', label: 'Dashboard', title: 'Dashboard', min: 'staff' },
      { to: '/monitoring', label: 'Ride Monitoring', title: 'Ride Monitoring', min: 'staff' },
      { to: '/ride-log', label: 'Ride Log', title: 'Ride Log', min: 'staff' },
      { to: '/emergency-alerts', label: 'Emergency Alerts', title: 'Emergency Alerts', min: 'staff' },
    ],
  },
  {
    caption: 'People',
    items: [
      { to: '/drivers', label: 'Drivers', title: 'Driver Management', min: 'staff' },
      { to: '/passengers', label: 'Passengers', title: 'Passenger Management', min: 'staff' },
      { to: '/tricycles', label: 'Tricycles', title: 'Tricycle Monitoring', min: 'staff' },
      { to: '/verification', label: 'Verification', title: 'Driver & Tricycle Verification', min: 'staff' },
      { to: '/discounts', label: 'Fare Discounts', title: 'Fare Discount Review', min: 'staff' },
    ],
  },
  {
    caption: 'Casework',
    items: [
      { to: '/complaints', label: 'Complaints', title: 'Complaints Management', min: 'staff' },
      { to: '/rating-oversight', label: 'Rating Oversight', title: 'Rating Oversight', min: 'staff' },
    ],
  },
  {
    caption: 'Insight',
    items: [
      { to: '/reports', label: 'Reports & Analytics', title: 'Reports & Analytics', min: 'staff' },
      { to: '/audit-log', label: 'Audit Log', title: 'Audit Log', min: 'staff' },
    ],
  },
  {
    caption: 'Administration',
    items: [
      { to: '/pso-users', label: 'PSO Users', title: 'PSO User Management', min: 'admin' },
      { to: '/barangays', label: 'Barangays', title: 'Barangay Reference Data', min: 'admin' },
      { to: '/settings', label: 'System Settings', title: 'System Settings', min: 'admin' },
    ],
  },
];

export const ROUTE_TITLES: Record<string, string> = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items).map((item) => [item.to, item.title]),
);

export function visibleNavItems(role: AdminRole | undefined): NavItem[] {
  if (!role) return [];
  return NAV_GROUPS.flatMap((g) => g.items).filter((item) => meetsRoleGate(role, item.min));
}

/** Case-insensitive match on label or group caption; startsWith ranks above includes, stable otherwise. */
export function matchNavItems(query: string, items: NavItem[]): NavItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const captionByTo = new Map<string, string>();
  for (const group of NAV_GROUPS) {
    for (const item of group.items) captionByTo.set(item.to, group.caption);
  }

  const scored = items
    .map((item) => {
      const label = item.label.toLowerCase();
      const caption = (captionByTo.get(item.to) ?? '').toLowerCase();
      if (label.startsWith(q)) return { item, rank: 0 };
      if (label.includes(q) || caption.includes(q)) return { item, rank: 1 };
      return null;
    })
    .filter((x): x is { item: NavItem; rank: number } => x !== null);

  scored.sort((a, b) => a.rank - b.rank);
  return scored.map((s) => s.item);
}
