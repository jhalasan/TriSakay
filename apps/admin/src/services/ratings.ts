import { listFlaggedLowRatings as listFlaggedLowRatingsShared } from '@trisakay/services';
import type { FlaggedLowRatingRow } from '@trisakay/services';
import type { ServiceResult } from './drivers';

export type { FlaggedLowRatingRow };

/** Thin wrapper over packages/services/src/admin/ratings.ts, matching this app's one-file-per-feature convention. */
export async function listFlaggedLowRatings(): Promise<ServiceResult<FlaggedLowRatingRow[]>> {
  const { data, error } = await listFlaggedLowRatingsShared();
  return { data, error };
}
