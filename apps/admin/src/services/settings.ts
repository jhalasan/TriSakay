import {
  getAdminFareConfig,
  getAdminFeatureToggles,
  getAdminSystemSettings,
  updateAdminFareConfig,
  updateAdminFeatureToggles,
} from '@trisakay/services';
import type { FareConfig, FeatureToggles, SystemSettings } from '../types/settings';
import type { ServiceResult } from './drivers';

/** Admin-only (FR-8.1). */
export async function getFareConfig(): Promise<ServiceResult<FareConfig | null>> {
  const { data, error } = await getAdminFareConfig();
  return { data, error };
}

/** The current UI form always collects baseFare/baseKm/ratePerKm together, but the store's saveFareConfig() types this as Partial<FareConfig> — degrade to an error rather than silently sending `undefined` to the RPC. */
export async function updateFareConfig(patch: Partial<FareConfig>): Promise<ServiceResult<null>> {
  if (patch.baseFare === undefined || patch.baseKm === undefined || patch.ratePerKm === undefined) {
    return { data: null, error: 'Base fare, base distance, and rate per km are all required.' };
  }
  const { error } = await updateAdminFareConfig({ baseFare: patch.baseFare, baseKm: patch.baseKm, ratePerKm: patch.ratePerKm });
  return { data: null, error };
}

export async function getSystemSettings(): Promise<ServiceResult<SystemSettings | null>> {
  const { data, error } = await getAdminSystemSettings();
  return { data, error };
}

export async function getFeatureToggles(): Promise<ServiceResult<FeatureToggles | null>> {
  const { data, error } = await getAdminFeatureToggles();
  return { data, error };
}

export async function updateFeatureToggles(patch: Partial<FeatureToggles>): Promise<ServiceResult<null>> {
  const { error } = await updateAdminFeatureToggles(patch);
  return { data: null, error };
}
