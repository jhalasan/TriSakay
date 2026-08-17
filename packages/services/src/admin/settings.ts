import { getSupabaseClient } from '../supabase/client.ts';

export interface AdminFareConfig {
  baseFare: number;
  baseKm: number;
  ratePerKm: number;
  discountRatePercent: number;
  ordinanceRef: string | null;
}

export interface GetAdminFareConfigResult {
  data: AdminFareConfig | null;
  error: string | null;
}

/** FR-8.1 — the active tariff. fare_config is versioned (fare_config_one_active partial unique index), so this always reads the current is_active=true row. */
export async function getAdminFareConfig(): Promise<GetAdminFareConfigResult> {
  const { data, error } = await getSupabaseClient()
    .from('fare_config')
    .select('base_fare, base_km, rate_per_km, discount_rate_percent, ordinance_ref')
    .eq('is_active', true)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };

  return {
    data: {
      baseFare: data.base_fare,
      baseKm: data.base_km,
      ratePerKm: data.rate_per_km,
      discountRatePercent: data.discount_rate_percent,
      ordinanceRef: data.ordinance_ref,
    },
    error: null,
  };
}

export interface UpdateAdminFareConfigInput {
  baseFare: number;
  baseKm: number;
  ratePerKm: number;
}

export interface UpdateAdminFareConfigResult {
  error: string | null;
}

/**
 * Calls the update_fare_config() RPC — the only write path for fare_config.
 * fare_config's versioning (exactly one is_active=true row, enforced by a
 * partial unique index) means an update is really "deactivate the current
 * row, insert a new active one." Doing that as two separate client calls
 * risks leaving zero active rows if the second one fails; compute_fare()
 * and every getFareConfig() caller across all three apps reads that row
 * live for real fare quotes, so the RPC makes the pair atomic. The UI only
 * ever edits baseFare/baseKm/ratePerKm — discountRatePercent and
 * ordinanceRef carry over from the current active row untouched.
 */
export async function updateAdminFareConfig(patch: UpdateAdminFareConfigInput): Promise<UpdateAdminFareConfigResult> {
  const client = getSupabaseClient();

  const { data: current, error: currentError } = await client
    .from('fare_config')
    .select('discount_rate_percent, ordinance_ref')
    .eq('is_active', true)
    .maybeSingle();

  if (currentError) return { error: currentError.message };
  if (!current) return { error: 'No active fare configuration found' };

  const { error } = await client.rpc('update_fare_config', {
    p_base_fare: patch.baseFare,
    p_base_km: patch.baseKm,
    p_rate_per_km: patch.ratePerKm,
    p_discount_rate_percent: current.discount_rate_percent,
    p_ordinance_ref: current.ordinance_ref,
  });

  return { error: error?.message ?? null };
}

export interface AdminSystemSettings {
  bearingToleranceDeg: number;
  detourRatioMax: number;
  searchRadiusKm: number;
  lowRatingThreshold: number;
}

export interface GetAdminSystemSettingsResult {
  data: AdminSystemSettings | null;
  error: string | null;
}

/** FR-8.1 — read-only in the UI today (the matching heuristic thresholds have no edit form yet). */
export async function getAdminSystemSettings(): Promise<GetAdminSystemSettingsResult> {
  const { data, error } = await getSupabaseClient()
    .from('system_settings')
    .select('bearing_tolerance_deg, detour_ratio_max, search_radius_km, low_rating_threshold')
    .eq('is_active', true)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };

  return {
    data: {
      bearingToleranceDeg: data.bearing_tolerance_deg,
      detourRatioMax: data.detour_ratio_max,
      searchRadiusKm: data.search_radius_km,
      lowRatingThreshold: data.low_rating_threshold,
    },
    error: null,
  };
}

export interface AdminFeatureToggles {
  gcashEnabled: boolean;
  cashEnabled: boolean;
  franchiseExpiryNotifications: boolean;
}

export interface GetAdminFeatureTogglesResult {
  data: AdminFeatureToggles | null;
  error: string | null;
}

/** Backed by 3 columns on system_settings (docs/ADMIN_TODO.MD open decision #5) — not versioned like fare_config; a toggle flip is a live in-place update, not a policy amendment worth preserving history for. */
export async function getAdminFeatureToggles(): Promise<GetAdminFeatureTogglesResult> {
  const { data, error } = await getSupabaseClient()
    .from('system_settings')
    .select('gcash_enabled, cash_enabled, franchise_expiry_notifications')
    .eq('is_active', true)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };

  return {
    data: {
      gcashEnabled: data.gcash_enabled,
      cashEnabled: data.cash_enabled,
      franchiseExpiryNotifications: data.franchise_expiry_notifications,
    },
    error: null,
  };
}

export interface UpdateAdminFeatureTogglesResult {
  error: string | null;
}

export async function updateAdminFeatureToggles(patch: Partial<AdminFeatureToggles>): Promise<UpdateAdminFeatureTogglesResult> {
  const dbPatch: { gcash_enabled?: boolean; cash_enabled?: boolean; franchise_expiry_notifications?: boolean } = {};
  if (patch.gcashEnabled !== undefined) dbPatch.gcash_enabled = patch.gcashEnabled;
  if (patch.cashEnabled !== undefined) dbPatch.cash_enabled = patch.cashEnabled;
  if (patch.franchiseExpiryNotifications !== undefined) dbPatch.franchise_expiry_notifications = patch.franchiseExpiryNotifications;

  if (Object.keys(dbPatch).length === 0) return { error: null };

  const { error } = await getSupabaseClient().from('system_settings').update(dbPatch).eq('is_active', true);
  return { error: error?.message ?? null };
}
