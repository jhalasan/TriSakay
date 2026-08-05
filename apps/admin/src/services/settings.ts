import { MOCK_FARE_CONFIG, MOCK_FEATURE_TOGGLES, MOCK_SYSTEM_SETTINGS } from '../mocks/settings.ts';
import { wait } from '../mocks/delay.ts';
import type { FareConfig, FeatureToggles, SystemSettings } from '../types/settings';
import type { ServiceResult } from './drivers';

let fareConfig = { ...MOCK_FARE_CONFIG };
let systemSettings = { ...MOCK_SYSTEM_SETTINGS };
let featureToggles = { ...MOCK_FEATURE_TOGGLES };

/** Admin-only (FR-8.1). */
export async function getFareConfig(): Promise<ServiceResult<FareConfig>> {
  await wait();
  return { data: fareConfig, error: null };
}

export async function updateFareConfig(patch: Partial<FareConfig>): Promise<ServiceResult<null>> {
  await wait();
  fareConfig = { ...fareConfig, ...patch };
  return { data: null, error: null };
}

export async function getSystemSettings(): Promise<ServiceResult<SystemSettings>> {
  await wait();
  return { data: systemSettings, error: null };
}

export async function getFeatureToggles(): Promise<ServiceResult<FeatureToggles>> {
  await wait();
  return { data: featureToggles, error: null };
}

export async function updateFeatureToggles(patch: Partial<FeatureToggles>): Promise<ServiceResult<null>> {
  await wait();
  featureToggles = { ...featureToggles, ...patch };
  return { data: null, error: null };
}
