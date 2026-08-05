/** Mirrors docs/SCHEMA.MD `fare_config` (§3.3) — versioned, so an ordinance amendment doesn't destroy history. */
export interface FareConfig {
  baseFare: number; // 15.00, City Ordinance No. 08, s.2023
  baseKm: number; // 4.00
  ratePerKm: number; // 1.00
  discountRatePercent: number; // 20.00, RA 9994 / RA 10754 (FR-3.12)
  ordinanceRef: string;
}

/** Mirrors docs/SCHEMA.MD `system_settings` (§3.4) — matching heuristic thresholds, FR-2.5. */
export interface SystemSettings {
  bearingToleranceDeg: number; // 40.00
  detourRatioMax: number; // 1.25
  searchRadiusKm: number; // 3.00
  lowRatingThreshold: number; // 3.00, FR-10.4
}

export interface FeatureToggles {
  gcashEnabled: boolean;
  cashEnabled: boolean;
  franchiseExpiryNotifications: boolean;
}
