export function formatCurrency(value: number, symbol = '₱') {
  return `${symbol}${value.toFixed(2)}`;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance in kilometres — straight-line, not routed; the fare RPC rounds up to the nearest km, which absorbs the difference for a trip this short. */
export function haversineDistanceKm(from: GeoPoint, to: GeoPoint): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.asin(Math.sqrt(a));

  return EARTH_RADIUS_KM * c;
}

/** Same strictness as the admin portal's password policy (`apps/admin/src/lib/passwordPolicy.ts`) — used at every NEW-password creation point (register, reset), never at login, since tightening login-time validation would lock out accounts created under an older, weaker rule. */
export const MIN_PASSWORD_LENGTH = 10;

export function isPasswordPolicyMet(password: string): boolean {
  return (
    password.length >= MIN_PASSWORD_LENGTH &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    (/\d/.test(password) || /[^A-Za-z0-9]/.test(password))
  );
}
