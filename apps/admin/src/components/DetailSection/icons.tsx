import type { SVGProps } from 'react';

/**
 * Section-header icons for DetailSection — one per group (Contact, Vehicle,
 * Performance, Account, Rides), not per field. Same stroke convention as
 * Sidebar/navIcons.tsx (16px, viewBox 0 0 24 24, stroke=currentColor,
 * strokeWidth 1.7, round caps/joins) so a detail modal reads as the same
 * icon system as the nav rail, not a second one.
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

export function ContactIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 5.5c0-1 .8-1.8 1.8-1.8h2.1c.5 0 .9.3 1 .8l.9 3a1.1 1.1 0 0 1-.3 1.1L8 10c1 2.1 2.9 4 5 5l1.4-1.5a1.1 1.1 0 0 1 1.1-.3l3 .9c.5.1.8.5.8 1v2.1c0 1-.8 1.8-1.8 1.8C10.7 19 5 13.3 4 5.5Z" />
    </Svg>
  );
}

export function VehicleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4.5 16v-4.2c0-.4.15-.8.43-1.08l1.7-1.72A2 2 0 0 1 8.06 8.3h7.88c.53 0 1.04.21 1.42.6l1.7 1.72c.29.28.44.67.44 1.08V16" />
      <path d="M4.5 16h15v2a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1h-9v1a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-2Z" />
      <circle cx="8" cy="16" r="1.4" />
      <circle cx="16" cy="16" r="1.4" />
    </Svg>
  );
}

export function PerformanceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 3.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8L12 3.5Z" />
    </Svg>
  );
}

export function AccountIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17" />
      <path d="M7.5 13.5h4" />
    </Svg>
  );
}

export function FranchiseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M6 3.5h9l3.5 3.5V19a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5Z" />
      <path d="M15 3.5V7h3.5" />
      <path d="M7.5 12.5h9M7.5 15.8h6" />
    </Svg>
  );
}

export function RidesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 21s-6.5-5.9-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.1 12 21 12 21Z" />
      <circle cx="12" cy="10.5" r="2.3" />
    </Svg>
  );
}
