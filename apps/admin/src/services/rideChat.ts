import { adminViewRideMessages, listRideMessageViewLog as listRideMessageViewLogShared } from '@trisakay/services';
import type { AdminRideMessage, RideMessageViewLogRow } from '@trisakay/services';
import type { ServiceResult } from './drivers';

export type { AdminRideMessage, RideMessageViewLogRow };

/**
 * Thin wrapper over packages/services/src/admin/rideChat.ts, matching this
 * app's one-file-per-feature convention. Surfaces the RPC's own rejection
 * text (no linked complaint/alert, blank reason, not PSO) straight through —
 * see admin_view_ride_messages() in the S1 migration for the exact wording.
 */
export async function viewRideMessages(rideRequestId: string, reason: string): Promise<ServiceResult<AdminRideMessage[]>> {
  return adminViewRideMessages(rideRequestId, reason);
}

export interface ListRideMessageViewLogResult extends ServiceResult<RideMessageViewLogRow[]> {
  truncated: boolean;
}

export async function listRideMessageViewLog(sinceIso: string | null = null): Promise<ListRideMessageViewLogResult> {
  const { data, error, truncated } = await listRideMessageViewLogShared(sinceIso);
  return { data, error, truncated };
}
