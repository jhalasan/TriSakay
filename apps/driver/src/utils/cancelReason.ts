import { DRIVER_CANCEL_REASON_CODES } from '@trisakay/shared';
import type { Translations } from '@trisakay/shared';
import type { TripHistoryItem } from '../types/history';

/**
 * A driver-facing label for a cancelled trip (README §4, "Cancelled card").
 * `cancelReasonCode`/`cancelledBy` only exist from PD1 onward (see
 * supabase/migrations/20260928000001_driver_history_cancel_code.sql) — pre-PD1
 * rows fall back to the free-text `cancelReason` column, then to null (hides
 * the reason line entirely rather than showing an empty string).
 */
export function driverHistoryCancelReasonLabel(item: TripHistoryItem, t: Translations): string | null {
  if (item.cancelledBy === 'passenger') return t.driver.history.cancelledByPassenger;
  if (item.cancelledBy === 'system' || item.cancelReasonCode === 'expired') return t.driver.history.cancelledBySystem;
  if (item.cancelledBy === 'driver' && item.cancelReasonCode) {
    const codes: readonly string[] = DRIVER_CANCEL_REASON_CODES;
    if (codes.includes(item.cancelReasonCode)) {
      return t.driver.tripActive.cancelReasons[item.cancelReasonCode as (typeof DRIVER_CANCEL_REASON_CODES)[number]];
    }
  }
  return item.cancelReason;
}
