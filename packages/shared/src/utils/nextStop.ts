import { haversineKm } from './geo.ts';

/**
 * D2 (UAT panel, Adrales): with several passengers on one trip, the driver's
 * list is ordered by each passenger's *next* stop — their drop-off if on
 * board, their pickup if still waiting. A greedy nearest-neighbour ordering
 * with two priorities checked before distance:
 *   1. A waiting transfer pickup (D1 handoff) goes first, except that an
 *      on-board drop-off 300 m or less away is served before it.
 *   2. An overdue passenger (more than 1.5x the normal time for their
 *      distance at tricycle speed) comes next, so new mid-trip pickups can't
 *      push someone back forever.
 *   3. Everyone else by straight-line distance, with a 150 m no-jump rule so
 *      GPS jitter doesn't keep swapping cards.
 * Optimal stop ordering (trying every order) is future work.
 */

export const TRICYCLE_SPEED_KMH = 20;
export const OVERDUE_FACTOR = 1.5;
/** Floor on "normal time" so a stop a few metres away isn't overdue within seconds. */
export const MIN_NORMAL_MINUTES = 5;
export const NO_JUMP_KM = 0.15;
export const TRANSFER_EXCEPTION_KM = 0.3;

export interface NextStopPassenger {
  id: string;
  status: 'assigned' | 'ongoing';
  pickupLat: number | null;
  pickupLng: number | null;
  destLat: number | null;
  destLng: number | null;
  /** When the ride was accepted — the overdue clock for a waiting passenger. */
  assignedAt?: string | null;
  /** When the passenger was picked up — the overdue clock once on board. */
  pickedUpAt?: string | null;
  /** Booked ride distance; falls back to straight-line pickup to drop-off. */
  distanceKm?: number | null;
  /** D1: this pickup is a transfer handoff point. */
  isTransferPickup?: boolean;
}

export interface SortedStop<T extends NextStopPassenger> {
  passenger: T;
  stopLat: number | null;
  stopLng: number | null;
  /** Straight-line km from the driver to the stop; null without a GPS fix or stop coordinates. */
  distanceKm: number | null;
}

function nextStopOf(p: NextStopPassenger): { lat: number | null; lng: number | null } {
  return p.status === 'ongoing' ? { lat: p.destLat, lng: p.destLng } : { lat: p.pickupLat, lng: p.pickupLng };
}

/**
 * Whether a passenger has taken more than 1.5x the normal time. On board:
 * time since pickup against the ride distance. Waiting: time since accept
 * against the driver's current distance to the pickup.
 */
export function isStopOverdue(p: NextStopPassenger, distanceToStopKm: number | null, now: number): boolean {
  const startedAt = p.status === 'ongoing' ? p.pickedUpAt : p.assignedAt;
  if (!startedAt) return false;

  let km: number | null;
  if (p.status === 'ongoing') {
    km =
      p.distanceKm ??
      (p.pickupLat !== null && p.pickupLng !== null && p.destLat !== null && p.destLng !== null
        ? haversineKm(p.pickupLat, p.pickupLng, p.destLat, p.destLng)
        : null);
  } else {
    km = distanceToStopKm;
  }
  if (km === null) return false;

  const normalMinutes = Math.max((km / TRICYCLE_SPEED_KMH) * 60, MIN_NORMAL_MINUTES);
  const elapsedMinutes = (now - Date.parse(startedAt)) / 60_000;
  return elapsedMinutes > normalMinutes * OVERDUE_FACTOR;
}

/**
 * Greedy nearest-first within one priority group. The stop that was highest
 * in `previousOrder` keeps its place unless another is at least 150 m closer.
 */
function greedyByDistance<T extends NextStopPassenger>(group: SortedStop<T>[], rank: Map<string, number>): SortedStop<T>[] {
  const remaining = [...group];
  const out: SortedStop<T>[] = [];
  while (remaining.length > 0) {
    let closest = remaining[0];
    let incumbent: SortedStop<T> | null = null;
    for (const s of remaining) {
      if (s.distanceKm! < closest.distanceKm!) closest = s;
      const r = rank.get(s.passenger.id);
      if (r !== undefined && (incumbent === null || r < rank.get(incumbent.passenger.id)!)) incumbent = s;
    }
    const pick = incumbent && incumbent.distanceKm! - closest.distanceKm! < NO_JUMP_KM ? incumbent : closest;
    out.push(pick);
    remaining.splice(remaining.indexOf(pick), 1);
  }
  return out;
}

/**
 * @param passengers in accept order
 * @param driverPos the driver's current position, or null without a GPS fix
 * @param previousOrder passenger ids in the order last shown, for the no-jump rule
 */
export function sortByNextStop<T extends NextStopPassenger>(
  passengers: T[],
  driverPos: { lat: number; lng: number } | null,
  previousOrder: string[],
  now: number = Date.now(),
): SortedStop<T>[] {
  const rank = new Map(previousOrder.map((id, i) => [id, i]));

  const stops: SortedStop<T>[] = passengers.map((passenger) => {
    const { lat, lng } = nextStopOf(passenger);
    const distanceKm = driverPos && lat !== null && lng !== null ? haversineKm(driverPos.lat, driverPos.lng, lat, lng) : null;
    return { passenger, stopLat: lat, stopLng: lng, distanceKm };
  });

  if (!driverPos) {
    // Keep accept order (or the last shown order) until there's a fix.
    return stops
      .map((s, i) => ({ s, key: rank.get(s.passenger.id) ?? previousOrder.length + i }))
      .sort((a, b) => a.key - b.key)
      .map(({ s }) => s);
  }

  const located = stops.filter((s) => s.distanceKm !== null);
  const unlocated = stops.filter((s) => s.distanceKm === null);

  const hasTransferPickup = located.some((s) => s.passenger.status === 'assigned' && s.passenger.isTransferPickup);
  const groups: SortedStop<T>[][] = [[], [], [], []];
  for (const s of located) {
    const p = s.passenger;
    if (hasTransferPickup && p.status === 'ongoing' && s.distanceKm! <= TRANSFER_EXCEPTION_KM) groups[0].push(s);
    else if (p.status === 'assigned' && p.isTransferPickup) groups[1].push(s);
    else if (isStopOverdue(p, s.distanceKm, now)) groups[2].push(s);
    else groups[3].push(s);
  }

  return [...groups.flatMap((g) => greedyByDistance(g, rank)), ...unlocated];
}
