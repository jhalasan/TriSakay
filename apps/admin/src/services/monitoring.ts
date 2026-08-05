import { MOCK_ACTIVE_TRICYCLES, MOCK_RECENT_ACTIVITY } from '../mocks/rides.ts';
import { wait } from '../mocks/delay.ts';
import type { ActiveTricycleRow, RecentActivityRow } from '../types/ride';
import type { ServiceResult } from './drivers';

/**
 * Read-only (FR-5.1, 5.2). The eventual live version subscribes to
 * `trips`/`ride_requests`/`driver_profiles` via Supabase Realtime rather
 * than polling — see docs/CONTEXT.MD §9. Location stays coarse per NFR-2.5.
 */
export async function listActiveTricycles(): Promise<ServiceResult<ActiveTricycleRow[]>> {
  await wait();
  return { data: MOCK_ACTIVE_TRICYCLES, error: null };
}

export async function listRecentActivity(): Promise<ServiceResult<RecentActivityRow[]>> {
  await wait();
  return { data: MOCK_RECENT_ACTIVITY, error: null };
}
