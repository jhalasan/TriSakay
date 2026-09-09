import type { DriverRow } from '../types/driver';
import type { PassengerRow } from '../types/passenger';

export interface EntitySearchResult {
  key: string;
  to: string;
  label: string;
  sublabel: string;
  group: 'Drivers' | 'Passengers';
}

/** Matches by name, plate no, or email — the fields Drivers.tsx's own search box already searches. */
export function searchDrivers(query: string, drivers: DriverRow[], limit = 4): EntitySearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return drivers
    .filter((d) => d.fullName.toLowerCase().includes(q) || d.plateNo.toLowerCase().includes(q) || d.email.toLowerCase().includes(q))
    .slice(0, limit)
    .map((d) => ({ key: `driver:${d.id}`, to: `/drivers?highlight=${d.id}`, label: d.fullName, sublabel: d.plateNo, group: 'Drivers' as const }));
}

/** Matches by name or email — the fields Passengers.tsx's own search box already searches. */
export function searchPassengers(query: string, passengers: PassengerRow[], limit = 4): EntitySearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return passengers
    .filter((p) => p.fullName.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
    .slice(0, limit)
    .map((p) => ({ key: `passenger:${p.id}`, to: `/passengers?highlight=${p.id}`, label: p.fullName, sublabel: p.email, group: 'Passengers' as const }));
}
