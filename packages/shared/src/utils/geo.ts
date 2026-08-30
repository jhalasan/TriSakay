const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two lat/lng points, in kilometres. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Straight-line ETA estimate — deliberately not a routing-engine call (see
 * docs/superpowers/specs/2026-08-30-live-tracking-and-pickup-confirmation-design.md
 * Decision 2). Consistent with the matching heuristic's own haversine-only approach.
 */
export function estimateEtaMinutes(distanceKm: number, speedKmh: number): number {
  if (distanceKm <= 0) return 0;
  return Math.round((distanceKm / speedKmh) * 60);
}
