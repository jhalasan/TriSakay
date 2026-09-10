import { create } from 'zustand';
import { listPassengerTripHistory } from '@trisakay/services';
import type { RideHistoryItem } from '../types/ride';

interface HistoryState {
  items: RideHistoryItem[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
}

export const useHistoryStore = create<HistoryState>()((set) => {
  // Guards against an out-of-order resolution when a focus-triggered load()
  // overlaps a pull-to-refresh triggered one — same pattern as the driver
  // app's useDriverStore checkRating/checkAcceptRate.
  let loadEpoch = 0;

  return {
    items: [],
    loading: false,
    error: null,

    load: async () => {
      const epoch = ++loadEpoch;
      set({ loading: true, error: null });

      const { data, error } = await listPassengerTripHistory();
      if (epoch !== loadEpoch) return;

      if (error) {
        set({ loading: false, error });
        return;
      }

      set({
        loading: false,
        items: data.map((item) => ({
          id: item.rideRequestId,
          driverName: item.driverName ?? '',
          driverRating: item.driverRating,
          plateNo: item.plateNo,
          bodyNo: item.bodyNo,
          date: item.date,
          pickup: item.pickup ?? '',
          dropoff: item.dropoff ?? '',
          fare: item.fare ?? 0,
          seats: item.seats,
          status: item.status === 'completed' ? 'done' : 'cancelled',
          paymentMethod: item.paymentMethod,
          paymentStatus: item.paymentStatus,
          distanceKm: item.distanceKm,
          durationMinutes: item.durationMinutes,
          discountApplied: item.discountApplied,
          discountPercent: item.discountPercent,
          cancelReason: item.cancelReason,
        })),
      });
    },
  };
});
