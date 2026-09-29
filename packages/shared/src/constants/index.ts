export const APP_NAMES = {
  passenger: 'TriSakay Passenger',
  driver: 'TriSakay Driver',
  admin: 'TriSakay Admin',
} as const;

/** Assumed average tricycle speed for straight-line ETA estimates (km/h). Not measured — a documented approximation. */
export const ASSUMED_TRICYCLE_SPEED_KMH = 20;

/**
 * PD1 (UAT audit): fixed cancellation reason codes, mirrored exactly by the
 * `cancel_ride_request`/`cancel_ride_leg` RPCs' own CHECK constraint
 * (20260927000005_pd1_cancellation_policy.sql) — a code outside these lists
 * is rejected server-side, so the two must stay in sync.
 */
export const PASSENGER_CANCEL_REASON_CODES = [
  'changed_mind',
  'found_other_ride',
  'wait_too_long',
  'price_concern',
  'other',
] as const;

export const DRIVER_CANCEL_REASON_CODES = [
  'vehicle_issue',
  'passenger_no_show',
  'unsafe_location',
  'personal_emergency',
  'passenger_asked_to_cancel',
  'other',
] as const;

export type PassengerCancelReasonCode = (typeof PASSENGER_CANCEL_REASON_CODES)[number];
export type DriverCancelReasonCode = (typeof DRIVER_CANCEL_REASON_CODES)[number];

/** D1 (UAT audit): fixed reason codes for a driver-initiated transfer or pool release — free text, not CHECK-constrained server-side (invite_transfer/release_to_pool store `p_reason` as-is), but fixed here for a consistent picker UI. */
export const TRANSFER_REASON_CODES = ['breakdown', 'full_seats', 'route', 'other'] as const;
export type TransferReasonCode = (typeof TRANSFER_REASON_CODES)[number];

/**
 * Ride comms redesign (README §4.3): Call is opt-in and off by default —
 * the repo has no call feature today, and chat's own phone-number masking
 * (L11) would be undermined by a raw `tel:` link. Flip this on only once a
 * masked/proxy number (or an explicit product decision to show the raw
 * number) actually exists; until then Call never renders and Message takes
 * the full width, in both apps.
 */
export const features = { rideCall: false } as const;
