import { getMyDiscount, type DiscountCategory } from '../discount/index.ts';
import { getFareDiscountRate } from '../fare/index.ts';
import { listPassengerTripHistory } from '../trip-history/index.ts';

// `DiscountCategory` is already exported from '../discount/index.ts' via the
// top-level barrel — re-exporting it here too would collide (TS2308).
export { formatDiscountLabel } from './formatDiscountLabel.ts';

export interface PassengerStats {
  /** Count of completed trips in the most recent 50 — this repo has no dedicated count RPC yet; 50 is the same cap `listPassengerTripHistory`'s only other caller (trip history screen) already uses. A passenger with more than 50 lifetime trips will see this figure undercount. */
  trips: number;
  discount: { category: DiscountCategory; ratePercent: number } | null;
  error: string | null;
}

export async function getPassengerStats(): Promise<PassengerStats> {
  const [historyResult, discountResult, rateResult] = await Promise.all([
    listPassengerTripHistory(50),
    getMyDiscount(),
    getFareDiscountRate(),
  ]);

  const trips = historyResult.data.filter((row) => row.status === 'completed').length;

  const approvedCategory =
    discountResult.data?.status === 'approved' ? (discountResult.data.category as DiscountCategory) : null;
  const discount =
    approvedCategory && rateResult.discountRatePercent != null
      ? { category: approvedCategory, ratePercent: rateResult.discountRatePercent }
      : null;

  const error = historyResult.error ?? discountResult.error ?? rateResult.error ?? null;
  return { trips, discount, error };
}
