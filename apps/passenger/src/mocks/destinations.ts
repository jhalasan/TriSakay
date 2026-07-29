import type { LocationPoint } from '../types/booking';

/**
 * Empty pending the backend. Destination search will be a query against real
 * place data (and the coordinates must come from the same source the tiles do,
 * or pins will sit next to the streets they name rather than on them).
 *
 * Kept as a module rather than inlined so there is exactly one place to wire the
 * real query into.
 */
export const destinations: LocationPoint[] = [];

export function searchDestinations(query: string): LocationPoint[] {
  const q = query.trim().toLowerCase();
  if (!q) return destinations;
  return destinations.filter(
    (d) => d.label.toLowerCase().includes(q) || d.address.toLowerCase().includes(q),
  );
}
