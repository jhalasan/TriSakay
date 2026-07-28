import type { LocationPoint } from '../types/booking';

export const mockDestinations: LocationPoint[] = [
  { label: 'SM City', address: 'National Highway, Poblacion' },
  { label: 'Public Market', address: 'Rizal St., Poblacion' },
  { label: 'St. Isidro Parish Church', address: 'Church St., Brgy. San Isidro' },
  { label: 'City Hall', address: 'Gov. Drive, Brgy. Poblacion' },
  { label: 'Central Elementary School', address: 'Mabini St., Brgy. San Roque' },
  { label: 'Riverside Terminal', address: 'Riverside Rd., Brgy. Wawa' },
];

export function searchDestinations(query: string): LocationPoint[] {
  const q = query.trim().toLowerCase();
  if (!q) return mockDestinations;
  return mockDestinations.filter(
    (d) => d.label.toLowerCase().includes(q) || d.address.toLowerCase().includes(q),
  );
}
