import type { RideHistoryItem } from '../types/ride';

/**
 * Empty pending the backend. Rides completed in-session are still appended by
 * the payment screen, so the list populates as you use the app — it just starts
 * with no invented history.
 */
export const seedRideHistory: RideHistoryItem[] = [];
