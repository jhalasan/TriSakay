import { create } from 'zustand';
import { listPassengerTripHistory } from '@trisakay/services';
import type { RideHistoryItem } from '../types/ride';

interface HistoryState {
  items: RideHistoryItem[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
}

export const useHistoryStore = create<HistoryState>()((set) => ({
  items: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });

    const { data, error } = await listPassengerTripHistory();
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
}));
