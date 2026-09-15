import type { SVGProps } from 'react';

/**
 * One 16px stroked icon per NAV_GROUPS item (README §1 "16px stroked
 * icon + 13/18 w500 label"). Kept local to Sidebar rather than exported as
 * a new src/components entry — these are wiring for one screen element,
 * not a reusable piece of the component vocabulary (hard rule 3b).
 */
function Svg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export const NAV_ICONS: Record<string, (props: SVGProps<SVGSVGElement>) => React.JSX.Element> = {
  '/': (props) => (
    <Svg {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.3" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.3" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.3" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.3" />
    </Svg>
  ),
  '/monitoring': (props) => (
    <Svg {...props}>
      <path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.3" />
    </Svg>
  ),
  '/emergency-alerts': (props) => (
    <Svg {...props}>
      <path d="M12 3.5 21.5 20h-19L12 3.5Z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17" r="0.15" fill="currentColor" />
    </Svg>
  ),
  '/drivers': (props) => (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.3" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M12 3.7v4.3M12 16v4.3M20.3 12H16M8 12H3.7" />
    </Svg>
  ),
  '/passengers': (props) => (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M4.7 20.3c1-3.6 4-5.8 7.3-5.8s6.3 2.2 7.3 5.8" />
    </Svg>
  ),
  '/tricycles': (props) => (
    <Svg {...props}>
      <path d="M4.5 16v-4.2c0-.4.15-.8.43-1.08l1.7-1.72A2 2 0 0 1 8.06 8.3h7.88c.53 0 1.04.21 1.42.6l1.7 1.72c.29.28.44.67.44 1.08V16" />
      <path d="M4.5 16h15v2a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1h-9v1a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-2Z" />
      <circle cx="8" cy="16" r="1.4" />
      <circle cx="16" cy="16" r="1.4" />
    </Svg>
  ),
  '/verification': (props) => (
    <Svg {...props}>
      <path d="M12 3.3 19 6v5.3c0 4.6-3 8.1-7 9.4-4-1.3-7-4.8-7-9.4V6l7-2.7Z" />
      <path d="m9 12 2 2 4-4.2" />
    </Svg>
  ),
  '/discounts': (props) => (
    <Svg {...props}>
      <circle cx="7.5" cy="7.5" r="2.5" />
      <circle cx="16.5" cy="16.5" r="2.5" />
      <path d="M18 6 6 18" />
    </Svg>
  ),
  '/complaints': (props) => (
    <Svg {...props}>
      <path d="M4 5.5h16v10.2H9.8L5.5 19V15.7H4V5.5Z" />
      <path d="M12 8.6v3M12 13.9v.1" />
    </Svg>
  ),
  '/rating-oversight': (props) => (
    <Svg {...props}>
      <path d="M4 15.5c1.8-6.5 5-9.5 8-9.5s6.2 3 8 9.5" />
      <path d="M4 15.5h16" />
      <path d="M9 19h6" />
    </Svg>
  ),
  '/reports': (props) => (
    <Svg {...props}>
      <path d="M4.5 20V10.5M12 20V4.5M19.5 20v-7" />
      <path d="M4.5 20h15" />
    </Svg>
  ),
  '/audit-log': (props) => (
    <Svg {...props}>
      <rect x="5" y="3.5" width="14" height="17" rx="1.6" />
      <path d="M9 8.5h6M9 12.5h6M9 16.5h3.5" />
    </Svg>
  ),
  '/pso-users': (props) => (
    <Svg {...props}>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.3 20c.8-3.2 3-5 5.7-5s4.9 1.8 5.7 5" />
      <path d="M16.5 6.2a3 3 0 0 1 0 5.9" />
      <path d="M16 15.4c1.9.4 3.3 1.9 3.9 4.6" />
    </Svg>
  ),
  '/barangays': (props) => (
    <Svg {...props}>
      <path d="M12 21s6.5-5.6 6.5-11A6.5 6.5 0 0 0 5.5 10c0 5.4 6.5 11 6.5 11Z" />
      <circle cx="12" cy="10" r="2.2" />
    </Svg>
  ),
  '/settings': (props) => (
    <Svg {...props}>
      <circle cx="12" cy="12" r="2.8" />
      <path d="M12 4.2v2M12 17.8v2M19.8 12h-2M6.2 12h-2M17.4 6.6l-1.4 1.4M8 16l-1.4 1.4M17.4 17.4 16 16M8 8 6.6 6.6" />
    </Svg>
  ),
};
