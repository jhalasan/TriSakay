import { getMyDiscount, type DiscountCategory } from '../discount/index.ts';
import { getFareDiscountRate } from '../fare/index.ts';
import { listPassengerTripHistory } from '../trip-history/index.ts';

// `DiscountCategory` is already exported from '../discount/index.ts' via the
// top-level barrel — re-exporting it here too would collide (TS2308).
export { formatDiscountLabel } from './formatDiscountLabel.ts';

export interface PassengerStats {
  /** Count of completed trips in the most recent 50 — this repo has no dedicated count RPC yet; 50 is the same cap `listPassengerTripHistory`'s only other caller (trip history screen) already uses. A passenger with more than 50 lifetime trips will see this figure undercount. */
  trips: number;
  discount: { category: DiscountCategory; ratePercent: number; expiresAt: string | null } | null;
  error: string | null;
}

/**
 * UAT A11 — mirrors compute_fare()'s own eligibility check: a discount row
 * can stay `status = 'approved'` in the DB past its expires_at (nothing
 * flips it automatically, no scheduler exists), so "is this discount
 * currently active" must check both, not status alone.
 */
function isDiscountActive(expiresAt: string | null): boolean {
  return !expiresAt || new Date(expiresAt).getTime() > Date.now();
}

export async function getPassengerStats(): Promise<PassengerStats> {
  const [historyResult, discountResult, rateResult] = await Promise.all([
    listPassengerTripHistory(50),
    getMyDiscount(),
    getFareDiscountRate(),
  ]);

  const trips = historyResult.data.filter((row) => row.status === 'completed').length;

  const approvedCategory =
    discountResult.data?.status === 'approved' && isDiscountActive(discountResult.data.expires_at)
      ? (discountResult.data.category as DiscountCategory)
      : null;
  const discount =
    approvedCategory && rateResult.discountRatePercent != null
      ? { category: approvedCategory, ratePercent: rateResult.discountRatePercent, expiresAt: discountResult.data!.expires_at }
      : null;

  const error = historyResult.error ?? discountResult.error ?? rateResult.error ?? null;
  return { trips, discount, error };
}
