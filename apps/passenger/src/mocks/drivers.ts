import type { Driver } from '../types/driver';

/**
 * Empty pending the backend — matching is a server concern, not a client one.
 *
 * `pickRandomDriver` still returns a record so the ride flow stays walkable end
 * to end for design review; every field the backend would supply is left unset,
 * and the UI renders those as placeholders rather than inventing a person. Swap
 * this for the real match response and the screens need no changes.
 */
export const drivers: Driver[] = [];

export function pickRandomDriver(): Driver {
  if (drivers.length > 0) {
    return drivers[Math.floor(Math.random() * drivers.length)];
  }
  return { id: 'pending', name: '', plateNumber: '', rating: null, etaMinutes: null };
}
