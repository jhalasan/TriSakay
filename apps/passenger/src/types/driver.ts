export interface Driver {
  id: string;
  name: string;
  plateNumber: string;
  /** Null until the backend supplies it — never render 0 stars for "unknown". */
  rating: number | null;
  etaMinutes: number | null;
  /** Null when the driver has no uploaded profile photo. */
  avatarUrl: string | null;
  /** Part B §B4.2 — the rating is hidden in the driver strip when this is under 5. */
  ratingCount: number;
  /** Part B §B4.2 — the "PSO verified" badge is hidden when false. */
  psoVerified: boolean;
}
