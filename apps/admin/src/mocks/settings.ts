import type { FareConfig, FeatureToggles, SystemSettings } from '../types/settings';

/** Matches the seed values in docs/SCHEMA.MD §8. */
export const MOCK_FARE_CONFIG: FareConfig = {
  baseFare: 15.0,
  baseKm: 4.0,
  ratePerKm: 1.0,
  discountRatePercent: 20.0,
  ordinanceRef: 'General Santos City Ordinance No. 08, s. 2023',
};

export const MOCK_SYSTEM_SETTINGS: SystemSettings = {
  bearingToleranceDeg: 40.0,
  detourRatioMax: 1.25,
  searchRadiusKm: 3.0,
  lowRatingThreshold: 3.0,
};

export const MOCK_FEATURE_TOGGLES: FeatureToggles = {
  gcashEnabled: true,
  cashEnabled: true,
  franchiseExpiryNotifications: true,
};
